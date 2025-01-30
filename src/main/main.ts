/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import puppeteer from 'puppeteer';
import { TimeoutError } from 'puppeteer';
import Store, { Schema } from 'electron-store';

type StoreType = {
  executablePath: string;
};

const schema: Schema<StoreType> = {
  executablePath: {
    type: 'string',
    default: '',
  },
};

const store = new Store<StoreType>({ schema });

let executablePath = '';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1366,
    height: 786,
    icon: getAssetPath('logo_mac.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      executablePath = store.get('executablePath');
      console.log('executable', executablePath);
      if (executablePath !== '') {
        mainWindow.webContents.send('chrome-path-from-server', executablePath);
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 *
 */

ipcMain.on('chrome-path', (event, arg) => {
  store.set('executablePath', arg);
  console.log(store.get('executablePath'));
  executablePath = arg;
  console.log(executablePath);
});

ipcMain.handle('get-data', async (event, data) => {
  let stop = false;
  if (!mainWindow) return;
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: executablePath,
  });
  try {
    const page = await browser.newPage();

    mainWindow.webContents.send('status', 'open browser');

    await page.goto('https://marcia.impi.gob.mx/marcas/search/quick', {
      waitUntil: 'domcontentloaded',
    });

    mainWindow.webContents.send('status', 'page opened');
    let info = [];

    try {
      await page.click('.advanced-options');
      await page.evaluate(() => {
        Array.from(document.querySelectorAll('span'))
          .filter((span) => {
            return span.innerText == 'Registrado'; // filter il for specific text
          })
          .forEach((element) => {
            if (element) element.click(); // click on il with specific text
          });
      });

      await page.evaluate((data) => {
        Array.from(document.querySelectorAll('span'))
          .filter((span) => {
            return span.innerText === data.tipo; // filter il for specific text
          })
          .forEach((element) => {
            if (element) element.click(); // click on il with specific text
          });
      }, data);

      await page.type('input[placeholder=Desde]', data.desde.toString());
      await page.type('input[placeholder=A]', data.hasta.toString());

      mainWindow.webContents.send('status', 'data entered');

      await page.evaluate(() => {
        Array.from(document.querySelectorAll('span'))
          .filter((span) => {
            return span.innerText == 'MARCA'; // filter il for specific text
          })
          .forEach((element) => {
            if (element) element.click(); // click on il with specific text
          });
      });

      const [response] = await Promise.all([
        page.waitForNavigation({
          waitUntil: 'load',
        }),
        page.click('button[type=submit]', { delay: 500 }),
      ]);
      console.log(response);

      await page.waitForSelector('.count');

      let total = await page.evaluate(() => {
        const countElement = document.querySelector('.count');
        return countElement ? (countElement as HTMLElement).innerText : '';
      });

      total = total.split(' ')[0].replace(',', '');
      console.log(parseInt(total));

      mainWindow.webContents.send('total', parseInt(total));

      try {
        await page.waitForSelector('tr.result-details-item-row', {
          timeout: 10000,
        });
      } catch (e: any) {
        console.error(e);
        mainWindow.webContents.send('error', e.message);
      }
      //click on the first tr.result-details-item-row
      const [resp1] = await Promise.all([
        page.waitForNavigation({
          waitUntil: 'load',
        }),
        page.click('tr.result-details-item-row', { delay: 50 }),
      ]);

      console.log(resp1);
      mainWindow.webContents.send('status', 'clicking on first result');

      await page.waitForSelector('dd');

      for (let count = 1; count <= parseInt(total); count++) {
        if (stop) break;
        if (count > 1) {
          const [resp2] = await Promise.all([
            page.waitForNavigation({
              waitUntil: 'load',
            }),
            page.click('svg[data-icon="angle-right"]'),
          ]);
          console.log(resp2);
        }
        await page.waitForSelector('dd');
        await page.waitForSelector('dt', {
          visible: true,
        });
        await page.waitForSelector('.table-data.left', {
          visible: true,
        });

        const data = await page.evaluate(() => {
          let data: { [key: string]: string } = {};
          const dd_elements = document.getElementsByTagName('dd');
          const dt_elements = document.getElementsByTagName('dt');
          const clase = Array.from(
            document.querySelectorAll('table tr'),
            (tr) => {
              const ths = Array.from(
                document.querySelectorAll('th'),
                (th) => th.innerText,
              );
              const tds = Array.from(
                document.querySelectorAll('td'),
                (td) => td.innerText,
              );
              let data = '';
              for (let i = 0; i < ths.length; i++) {
                if (ths[i] == 'Clase') {
                  data = tds[i];
                }
              }
              return data;
            },
          );

          //merge dt and dd elements like {[dt]: dd}, {[dt]: dd}, ...
          for (let i = 0; i < dd_elements.length; i++) {
            data[dt_elements[i].innerText] = dd_elements[i].innerText;
          }
          data['clase'] = clase[0];
          return data;
        });
        const datos = {
          data: data,
          count: count,
          total: total,
        };
        mainWindow.webContents.send('new-row', datos);
        //return data--------------------------------------------------
        info.push(data);
        console.log(count, data);
        if (count == parseInt(total)) break;
      }

      page.on('error', (err) => {
        console.error('Page error:', err);
      });

      page.on('pageerror', (err) => {
        console.error('Page runtime error:', err);
      });

      page.on('close', () => {
        console.log('Page closed unexpectedly');
      });

      //close browser on signal abort
      return info;
    } catch (e: any) {
      console.log(e);
      mainWindow.webContents.send('error', e.message);
      return [];
    } finally {
      await browser.close();
    }
  } catch (e: any) {
    if (e.name === 'TargetCloseError') {
      console.error('Target closed unexpectedly. Reconnecting...');
      mainWindow.webContents.send('error', 'Target closed unexpectedly');
      // Reconnect logic
    } else {
      console.error('Error launching browser:', e);
      mainWindow.webContents.send('error', e.message);
    }
  } finally {
    await browser.close();
  }
});

ipcMain.handle('get-clients', async (event, array) => {
  if (!mainWindow) return;
  try {
    let count = 0;
    let allcount = 0;
    let arrayLength = array.length;
    for (var item of array) {
      try {
        const cliente = await scrapperFunc(
          item['Nombre'].replace(/ *\([^)]*\) */g, ''),
        );
        console.log(cliente);
        //if cliente exists create the poroperty Cliente in the item and assign the value
        if (cliente) {
          item['Agente'] = cliente;
          count++;
          mainWindow.webContents.send('client-count', count);
        } else {
          //remove the item from the array
          array = array.filter((element: any) => element !== item);
        }
        allcount++;
        mainWindow.webContents.send('client-porcentaje', {
          count: allcount,
          total: arrayLength,
        });
      } catch (e) {
        console.log(e);
      }
    }
    return array;
  } catch (e: any) {
    console.log(e);
    mainWindow.webContents.send('error', e.message);
  }
});

ipcMain.handle('get-clients-dau', async (event, array) => {
  if (!mainWindow) return;
  try {
    let count = 0;
    let allcount = 0;
    let longitud = array.length;
    for (var item of array) {
      try {
        const data = await scrapperFuncDau(
          item['Número de registro internacional'],
        );
        console.log(data);
        //if cliente exists create the poroperty Cliente in the item and assign the value
        if (data) {
          item['Agente'] = data.client;
          item['Fecha de Registro'] = data['Fecha de Registro'];
          count++;
          mainWindow.webContents.send('client-count', count);
        } else {
          //remove the item from the array
          array = array.filter((element: any) => element !== item);
        }
        allcount++;
        mainWindow.webContents.send('client-porcentaje', {
          count: allcount,
          total: longitud,
        });
      } catch (e) {
        console.log(e);
      }
    }
    return array;
  } catch (e: any) {
    console.log('error', e);
    mainWindow.webContents.send('error', e.message);
  }
});

const scrapperFunc = async (data: any) => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: executablePath,
  });
  if (!mainWindow) return;
  try {
    const page = await browser.newPage();

    await page.goto('https://www3.wipo.int/madrid/monitor/en/', {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });

    //click on a tag with id "advancedModeLink"
    await page.evaluate(() => {
      const advancedModeLink = document.getElementById('advancedModeLink');
      if (advancedModeLink) {
        advancedModeLink.click();
      }
    });

    await page.waitForSelector('#HOL_input');

    await page.type('#HOL_input', `"${data}"`);

    //click on a tag with class "searchButton"
    await page.evaluate(() => {
      const searchButton = document.querySelector('.searchButton');
      if (searchButton) {
        (searchButton as HTMLElement).click();
      }
    });

    try {
      await page.waitForSelector('.jqgrow', { timeout: 5000 });
    } catch (e) {
      if (e instanceof TimeoutError) {
        await browser.close();
        return null;
      }
    }

    await page.evaluate(() => {
      const jqgrowElement = document.querySelector('.jqgrow');
      if (jqgrowElement) {
        (jqgrowElement as HTMLElement).click();
      }
    });

    try {
      await page.waitForSelector('.client.repType', { timeout: 5000 });
    } catch (e) {
      if (e instanceof TimeoutError) {
        await browser.close();
        return null;
      }
    }

    const client = await page.evaluate(() => {
      const clientElement = document.querySelector('.client.repType');
      return clientElement ? (clientElement as HTMLElement).innerText : null;
    });

    return client;
  } catch (e: any) {
    console.log(e);
    mainWindow.webContents.send('error', e.message);
    return null;
  } finally {
    await browser.close();
  }
};

const scrapperFuncDau = async (data: any) => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: executablePath,
  });
  if (!mainWindow) return;
  try {
    const page = await browser.newPage();

    try {
      await page.goto('https://www3.wipo.int/madrid/monitor/en/', {
        waitUntil: 'domcontentloaded',
      });

      //click on a tag with id "advancedModeLink"
      await page.evaluate(() => {
        const advancedModeLink = document.getElementById('advancedModeLink');
        if (advancedModeLink) {
          (advancedModeLink as HTMLElement).click();
        }
      });

      await page.waitForSelector('#IRN_input');

      await page.type('#IRN_input', data);

      //click on a tag with class "searchButton"
      await page.evaluate(() => {
        const searchButton = document.querySelector('.searchButton');
        if (searchButton) {
          (searchButton as HTMLElement).click();
        }
      });

      try {
        await page.waitForSelector('.jqgrow');
      } catch (e) {
        if (e instanceof TimeoutError) {
          await browser.close();
          return null;
        }
      }

      await page.evaluate(() => {
        const jqgrowElement = document.querySelector('.jqgrow');
        if (jqgrowElement) {
          (jqgrowElement as HTMLElement).click();
        }
      });

      try {
        await page.waitForSelector('.client.repType');
      } catch (e) {
        if (e instanceof TimeoutError) {
          await browser.close();
          return null;
        }
      }

      const registration_date = await page.evaluate(() => {
        const date = Array.from(
          document.querySelectorAll('.date'),
          (td) => (td as HTMLElement).innerText,
        );
        return date[2];
      });

      const client = await page.evaluate(() => {
        const clientElement = document.querySelector('.client.repType');
        return clientElement ? (clientElement as HTMLElement).innerText : null;
      });

      return { client: client, 'Fecha de Registro': registration_date };
    } catch (e: any) {
      console.log(e);
      mainWindow.webContents.send('error', e.message);
      return null;
    } finally {
      await browser.close();
    }
  } catch (e: any) {
    console.log(e);
    mainWindow.webContents.send('error', e.message);
  } finally {
    await browser.close();
  }
};

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
