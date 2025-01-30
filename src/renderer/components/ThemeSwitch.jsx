import { useState, useEffect } from 'react';

const ThemeSwitch = (props) => {
  const { theme, setTheme } = props;

  // useEffect only runs on the client, so now we can safely show the UI

  const handleThemeChange = async (e) => {
    const theme = e.target.value;
    const chamgeTheme = await window.electron.darkMode.invoke(
      'dark-mode:change',
      theme,
    );
    setTheme(theme);
  };

  return (
    <select value={theme} onChange={handleThemeChange}>
      <option value="system">System</option>
      <option value="dark">Dark</option>
      <option value="light">Light</option>
    </select>
  );
};

export default ThemeSwitch;
