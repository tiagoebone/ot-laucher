// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  openCalabreso: () => {
    ipcRenderer.send("open-client");
  },
  installCalabreso: () => {
    ipcRenderer.send("install-calabreso");
  },
  onUpdateStatus: (callback) => {
    ipcRenderer.on("update-status", callback);
  },
  onDeleteStatus: (callback) => {
    ipcRenderer.on("delete-status", callback);
  },
  getStoreValue: (key) => ipcRenderer.invoke("getStoreValue", key),
  setStoreValue: (key, value) => ipcRenderer.send("setStoreValue", key, value),
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
  resizeWindowTo720: () => ipcRenderer.send("resize-window-to-720"),
  resizeWindowTo600: () => ipcRenderer.send("resize-window-to-600"),
  loadURL: (url) => ipcRenderer.send("load-url", url),
});
