import React, { useEffect, useState } from 'react';
import { Tabs } from 'antd';
import type { TabsProps } from 'antd';
import Renovacion from './components/Renovacion';
import Dau from './components/Dau';

const onChange = (key: string) => {
  console.log(key);
};

const App: React.FC = () => {
  const [chromePathServer, setChromePathServer] = useState<string>('');

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
  }, []);

  return (
    <Tabs
      defaultActiveKey="1"
      centered={true}
      items={items}
      onChange={onChange}
    />
  );
};

export default App;
