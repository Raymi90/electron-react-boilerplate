import React, { useEffect, useState } from 'react';
import { Tabs, ConfigProvider, theme, Row, Col } from 'antd';
import ThemeSwitch from './components/ThemeSwitch';
import type { TabsProps } from 'antd';
import Renovacion from './components/Renovacion';
import Dau from './components/Dau';

const onChange = (key: string) => {
  console.log(key);
};

const { darkAlgorithm, defaultAlgorithm } = theme;

const App: React.FC = () => {
  const [chromePathServer, setChromePathServer] = useState<string>('');
  const [resolvedTheme, setResolvedTheme] = useState<string>('dark');

  const items: TabsProps['items'] = [
    {
      key: '1',
      label: 'Renovación',
      children: <Renovacion chromePathServer={chromePathServer} />,
    },
    {
      key: '2',
      label: 'Dau',
      children: <Dau chromePathServer={chromePathServer} />,
    },
  ];

  const handleChromePath = (data: any) => {
    setChromePathServer(data);
  };

  useEffect(() => {
    window.electron.ipcRenderer.on('chrome-path-from-server', handleChromePath);
    const defineDarkMode = async () => {
      const mode = await window.electron.darkMode.invoke('dark-mode:detect');
      setResolvedTheme(mode ? 'dark' : 'light');
    };
    defineDarkMode();
  }, []);

  return (
    <ConfigProvider
      theme={{
        // 1. Use dark algorithm
        algorithm: resolvedTheme === 'dark' ? darkAlgorithm : defaultAlgorithm,

        // 2. Combine dark algorithm and compact algorithm
        // algorithm: [theme.darkAlgorithm, theme.compactAlgorithm],
      }}
    >
      <Row>
        <ThemeSwitch theme={resolvedTheme} setTheme={setResolvedTheme} />
      </Row>
      <Row>
        <Col span={24}>
          <Tabs
            defaultActiveKey="1"
            centered={true}
            items={items}
            onChange={onChange}
          />
        </Col>
      </Row>
    </ConfigProvider>
  );
};

export default App;
