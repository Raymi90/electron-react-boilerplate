'use client';
import React, { useEffect, useRef, useState } from 'react';
import {
  Button,
  Col,
  ConfigProvider,
  DatePicker,
  Row,
  Table,
  Spin,
  Typography,
  Steps,
  Progress,
  message,
  Popconfirm,
  Select,
  Input,
} from 'antd';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { db } from '../../firebase/config';
import { collection, getDocs, query, where } from 'firebase/firestore';
import * as XLSX from 'xlsx';
const stringSimilarity = require('string-similarity');

dayjs.extend(customParseFormat);
const dateFormat = 'YYYY-MM-DD';

const { Text } = Typography;

export default function Dau({ chromePathServer }) {
  const [fetchedData, setFetchData] = useState([]);
  const [oldFetchData, setOldFetchData] = useState([]);
  const [fields, setFields] = useState({});
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState(-1);
  const [timeStamps, setTimeStamps] = useState([]);
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [clientCount, setClientCount] = useState(0);
  const [porcentaje, setPorcentaje] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();
  const [chromePath, setChromePath] = useState('');
  const [hide, setHide] = useState(false);
  const [file, setFile] = useState('');

  const getListaNegra = async () => {
    const listaNegraRef = collection(db, 'listaNegra');
    const data = await getDocs(listaNegraRef);
    let array = [];
    data.forEach((doc) => {
      array.push(doc.data());
    });
    return array;
  };

  const ref = useRef();

  const handleTotal = (data) => {
    setTotal(data); // Update the state with the total received
  };

  const handleNewRow = (data) => {
    console.log(data);
    if (!data.data) {
      setTotal(0);
      setLoading(false);
      return messageApi.info('No se encontraron registros en la base de datos');
    }
    setCount(data.count);
    setFetchData((prev) => [...prev, data.data]);
    setPorcentaje(Math.round((data.count / data.total) * 100));
    console.log(data);
  };

  const handleClientCount = (data) => {
    setClientCount(data);
  };

  const handleClientPorcentaje = (data) => {
    setCount(data.count);
    setPorcentaje(Math.round((data.count / data.total) * 100));
  };

  const handleChromePath = (data) => {
    setChromePath(data);
    setHide(true);
  };

  useEffect(() => {
    if (chromePathServer) {
      setChromePath(chromePathServer);
      setHide(true);
    }
  }, [chromePathServer]);

  //USEEFFECT++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  useEffect(() => {
    const removeEventListener = window.electron.ipcRenderer.on(
      'new-row',
      handleNewRow,
    );

    window.electron.ipcRenderer.on('total', handleTotal);
    window.electron.ipcRenderer.on('client-count', handleClientCount);
    window.electron.ipcRenderer.on('client-porcentaje', handleClientPorcentaje);

    return () => {
      removeEventListener();
    };
  }, []);

  const handleFetch = async () => {
    setCurrent(-1);
    setTimeStamps([]);
    setFetchData([]);
    setLoading(true);

    //first step

    setCurrent(0);
    setTimeStamps((prev) => [...prev, new Date().toLocaleTimeString()]);
    const campos = {
      ...fields,
    };

    //fetch with search params with no-corss origin
    const result = await window.electron.ipcRenderer.invoke('get-data', campos);
    if (result.length === 0) {
      setLoading(false);
      return;
    }
    setOldFetchData(result);
    console.log(result);
    setCurrent(1);
    setTimeStamps((prev) => [...prev, new Date().toLocaleTimeString()]);
    let array = await filterData(result);
    setCurrent(2);
    setTimeStamps((prev) => [...prev, new Date().toLocaleTimeString()]);
    setFetchData(array);
    setTotal(array.length);
    const clients = await window.electron.ipcRenderer.invoke(
      'get-clients-dau',
      array,
    );
    if (clients.length === 0) {
      setLoading(false);
      return;
    }
    setCurrent(3);
    setTimeStamps((prev) => [...prev, new Date().toLocaleTimeString()]);
    let arrayCli = await filterListaNegra(clients);
    setCurrent(4);
    setTimeStamps((prev) => [...prev, new Date().toLocaleTimeString()]);
    setFetchData(arrayCli);
    setLoading(false);
    setCurrent(5);
  };

  const filterData = async (data) => {
    const numRegistrosRef = collection(db, 'numRegistros');
    let array = [...data];
    //filter data where Número de registro is in numRegistros
    let count = 0;
    for (var item of data) {
      const q = query(
        numRegistrosRef,
        where('numRegistro', '==', parseInt(item['Número de registro'])),
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        console.log('No matching documents.');
      }
      querySnapshot.forEach((doc) => {
        array = data.filter(
          (item) => item['Número de registro'] !== doc.data().numRegistro,
        );
      });
      count++;
      setCount(count);
      setPorcentaje(Math.round((count / data.length) * 100));
    }
    array = array.filter((item) =>
      item.hasOwnProperty('Número de registro internacional'),
    );
    console.log(array);
    return array;
  };

  const filterListaNegra = async (array) => {
    setCount(0);
    let arrayAux = await getListaNegra();
    setTotal(array.length);
    let count = 0;
    //filter items from array that item["Agente"] is simliar to object.nombre in arrayAux
    for (var item of array) {
      for (var object of arrayAux) {
        if (
          stringSimilarity.compareTwoStrings(item['Agente'], object.nombre) >
          0.8
        ) {
          console.log(object.nombre, item['Agente']);
          array = array.filter((element) => element !== item);
        }
      }
      count++;
      setCount(count);
      setPorcentaje(Math.round((count / array.length) * 100));
    }
    return array;
  };

  const addListaNegra = async (nombre) => {
    const data = { nombre, isListed: true };

    const response = await fetch(
      `https://scrapper-ip-production.up.railway.app/listanegra`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      },
    );
    console.log(response);
    const json = await response.json();
    console.log(json);
    if (json.message === 'Usuario añadido a la lista negra') {
      messageApi.success(json.message);
      setFetchData((prev) => prev.filter((item) => item.Agente !== nombre));
      const response = await fetch(
        `https://scrapper-ip-production.up.railway.app/createrecord`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        },
      );

      const json1 = await response.json();
      console.log(json1);
      if (json1.message === 'Record created') {
        messageApi.success(`Record creado con id: ${json1.recordId}`);
      } else {
        messageApi.error(json1.message);
      }
    }
  };

  let items = [
    {
      title: 'Iniciar búsqueda',
      description: `Iniciando búsqueda... ${
        timeStamps[0] ? timeStamps[0] : ``
      }`,
    },
    {
      title: 'Filtrar registros',
      description: `Filtrando registros... ${
        timeStamps[1] ? timeStamps[1] : ``
      }`,
    },
    {
      title: 'Buscar en Madrid Monitor',
      description: `Buscando agentes... ${timeStamps[2] ? timeStamps[2] : ``}`,
    },
    {
      title: 'Filtrar en la lista negra',
      description: `Filtrando por la lista... ${
        timeStamps[3] ? timeStamps[3] : ``
      }`,
    },
    {
      title: 'Búsqueda completada',
      description: `Búsqueda completada... ${
        timeStamps[4] ? timeStamps[4] : ``
      }`,
    },
  ];

  const headers = [
    { label: 'Denominación', key: 'Denominación' },
    { label: 'Número de expediente', key: 'Número de expediente' },
    { label: 'Número de registro', key: 'Número de registro' },
    {
      label: 'Número de registro internacional',
      key: 'Número de registro internacional',
    },
    { label: 'Titular', key: 'Nombre' },
    { label: 'Agente', key: 'Agente' },
    { label: 'Dirección', key: 'Dirección' },
    { label: 'País', key: 'País' },
    { label: 'clase', key: 'clase' },
  ];

  const columns = [
    {
      title: 'Denominación',
      dataIndex: 'Denominación',
      key: 'Denominación',
    },
    {
      title: 'Número de expediente',
      dataIndex: 'Número de expediente',
      key: 'Número de expediente',
    },
    {
      title: 'Número de registro',
      dataIndex: 'Número de registro',
      key: 'Número de registro',
    },
    {
      title: 'Fecha de Registro',
      dataIndex: 'Fecha de Registro',
      key: 'Fecha de Registro',
      render: (_, record) => (
        <div>
          {dayjs(record['Fecha de Registro'], 'DD.MM.YYYY').format(
            'YYYY-MM-DD',
          ) &&
            dayjs(record['Fecha de Registro'], 'DD.MM.YYYY').format(
              'YYYY-MM-DD',
            )}
        </div>
      ),
    },
    {
      title: 'Número de registro internacional',
      dataIndex: 'Número de registro internacional',
      key: 'Número de registro internacional',
      filters: fetchedData
        .map((item) => item['Número de registro internacional'])
        .filter((value, index, self) => self.indexOf(value) === index)
        .map((value) => ({ text: value, value })),
      onFilter: (value, record) =>
        record['Número de registro internacional'] === value,
      filterSearch: true,
    },
    {
      title: 'Titular',
      dataIndex: 'Nombre',
      key: 'Nombre',
    },
    {
      title: 'Agente',
      dataIndex: 'Agente',
      key: 'Agente',
    },
    {
      title: 'Dirección',
      dataIndex: 'Dirección',
      key: 'Dirección',
    },
    {
      title: 'País',
      dataIndex: 'País',
      key: 'País',
    },
    {
      title: 'clase',
      dataIndex: 'clase',
      key: 'clase',
    },
    {
      title: 'Acciones',
      key: 'acciones',
      dataIndex: 'acciones',
      render: (_, record) => (
        <Popconfirm
          title="¿Estás seguro de añadir a la lista negra?"
          onConfirm={() => addListaNegra(record.Agente)}
          okText="Sí"
          cancelText="No"
        >
          <Button type="primary" danger>
            Añadir a la lista negra
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const exportXSLX = async (rows, filename) => {
    try {
      //REMOVE PROPERTY "Número de registro internacional" FROM ROWS
      rows = rows.map((row) => {
        delete row['acciones'];
        return row;
      });
      //change property names of row in rows
      rows = rows.map((row) => {
        return {
          TRADEMARK: row['Denominación'],
          'NAT.APPL.NUMBER': row['Número de expediente'],
          'NAT.REG.NUMBER': row['Número de registro'],
          'INT.REG.DATE': dayjs(row['Fecha de Registro'], 'DD.MM.YYYY').format(
            'DD/MM/YYYY',
          ),
          'INT.REG.NUMBER': row['Número de registro internacional'],
          'NAT.FILING DATE': row['Fecha de presentación'],
          'NAT. GRANTING DATE': row['Fecha de concesión'],
          'EXPIRATION DATE': row['Fecha de terminación'],
          OWNER: row['Nombre'],
          DESPACHOS: row['Agente'],
          DIRECCIÓN: row['Dirección'],
          PAÍS: row['País'],
          CLASE: row['clase'],
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      XLSX.writeFile(wb, filename);
      console;
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileChange = (e) => {
    //get the filepath of the file
    const file = e.target.files[0];
    console.log(file);
    setFile(file.name);
    console.log(file.path);
    setChromePath(file.path);
    setHide(true);
    window.electron.ipcRenderer.sendMessage('chrome-path', file.path);
  };

  return (
    <div>
      {contextHolder}
      <div style={{ width: '100%', height: '100vh' }}>
        {!hide ? (
          <Row justify={'center'} style={{ marginBottom: '20px' }}>
            <Col span={12}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  gap: '10px',
                  alignItems: 'center',
                }}
              >
                <Button onClick={() => ref.current?.click()}>
                  Selecciona ejecutable Chronme
                </Button>
                <span>{file}</span>
              </div>
              <input
                type="file"
                ref={ref}
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </Col>
          </Row>
        ) : (
          <Button onClick={() => setHide((prev) => !prev)}>
            Cambiar ejecutable
          </Button>
        )}
        <Row justify={'center'}>
          <Col span={12}>
            <DatePicker
              placeholder="Desde"
              format={dateFormat}
              onChange={(date, dateString) =>
                setFields({ ...fields, desde: dateString })
              }
              style={{ marginRight: '10px' }}
            />
            <DatePicker
              placeholder="Hasta"
              format={dateFormat}
              onChange={(date, dateString) =>
                setFields({ ...fields, hasta: dateString })
              }
              style={{ marginRight: '10px' }}
            />
            <Select
              placeholder="Tipo"
              style={{ width: '200px' }}
              onChange={(value) => setFields({ ...fields, tipo: value })}
            >
              <Select.Option value="Registro">DAU 3 años</Select.Option>
              <Select.Option value="Terminación">DAU 10 años</Select.Option>
            </Select>

            <Button
              disabled={
                loading || !fields.desde || !fields.hasta || chromePath === ''
              }
              style={{
                margin: '20px',
              }}
              type="primary"
              onClick={handleFetch}
            >
              Inciar búsqueda y Filtrado
            </Button>

            <Button
              disabled={loading}
              style={{ margin: '10px' }}
              type="primary"
              onClick={() => exportXSLX(fetchedData, 'data.xlsx')}
            >
              Exportar a Excel
            </Button>
          </Col>
        </Row>

        <Row justify={'center'}>
          <Col span={3}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                marginTop: '20px',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Steps
                direction="vertical"
                size="small"
                current={current}
                items={items}
              />
            </div>
          </Col>
          <Col span={19}>
            {current === 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'left',
                  gap: '10px',
                }}
              >
                <h3>Total de registros: {total}</h3>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '100%',
                  }}
                >
                  <Progress percent={porcentaje} status="active" />
                  {`${count}/${total}`}
                </div>
              </div>
            )}

            {current === 1 && (
              <div>
                <h3>Filtrando registros...</h3>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '100%',
                  }}
                >
                  <Progress percent={porcentaje} status="active" />
                  {`${count}/${total}`}
                </div>
              </div>
            )}

            {current === 2 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: '10px',
                }}
              >
                <h3>Total de clientes Encontrados: {clientCount}</h3>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '100%',
                  }}
                >
                  <Progress percent={porcentaje} status="active" />
                  {`${count}/${total}`}
                </div>
              </div>
            )}

            {current === 3 && (
              <div>
                <h3>Filtrando agentes...</h3>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '100%',
                  }}
                >
                  <Progress percent={porcentaje} status="active" />
                  {`${count}/${total}`}
                </div>
              </div>
            )}

            <Table
              loading={{
                spinning: loading,
                indicator: <Spin />,
              }}
              dataSource={fetchedData}
              columns={columns}
              rowKey={'Número de registro'}
            />
          </Col>
        </Row>
      </div>
    </div>
  );
}
