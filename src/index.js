const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const path = require("path");
const { exec } = require("child_process");
const os = require("os");
const AdmZip = require("adm-zip");
const fs = require("fs");
const Store = require("electron-store");
const { updateElectronApp } = require("update-electron-app");

updateElectronApp();
const store = new Store();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

function deleteFolderRecursive(directoryPath) {
  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach((file) => {
      const curPath = path.join(directoryPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        // Se for um diretório, recursão
        deleteFolderRecursive(curPath);
      } else {
        // Se for um arquivo, deleta
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(directoryPath);
  }
}

async function deleteClientFolder(webContents) {
  try {
    const calabresoPath = path.join(app.getPath("documents"), "Calabreso");
    await deleteFolderRecursive(calabresoPath);
    store.set("client", {});
    webContents.send("delete-status", "Client desinstalado com sucesso");
  } catch (err) {
    if (JSON.stringify(err).includes("unlink")) {
      webContents.send(
        "delete-status",
        "Erro: É necessário fechar o Client antes de desinstalar."
      );
    } else {
      webContents.send(
        "delete-status",
        "Erro: Ocorreu um erro ao desinstalar."
      );
    }
  }
}

let mainWindow;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    // frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      // contextIsolation: true,
    },
    icon: path.join(__dirname, "icon.ico"),
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "index.html"));

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  // mainWindow.setMenu(null);

  const menu = Menu.buildFromTemplate([
    {
      label: "Opções",
      submenu: [
        {
          label: "Reinstalar",
          click: () => mainWindow.webContents.send("invoke-installCalabreso"),
        },
        { type: "separator" },
        {
          label: "Checar por updates",
          click: () => mainWindow.webContents.send("handle-updates"),
        },
        { type: "separator" },
        {
          label: "Voltar a tela inicial",
          click: () => mainWindow.webContents.send("close-site"),
        },
        { type: "separator" },
        {
          label: "Abrir site",
          click: () => mainWindow.webContents.send("open-site"),
        },
        { type: "separator" },
        {
          label: "Remover Client",
          click: () => deleteClientFolder(mainWindow.webContents),
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Instalar Client
ipcMain.on("install-calabreso", async (event) => {
  const webContents = event.sender;
  try {
    const fetch = (...args) =>
      import("node-fetch").then(({ default: fetch }) => fetch(...args));
    const url =
      "https://calabreso.servegame.com/downloads/Calabreso_laucher.zip";

    webContents.send("update-status", "Baixando Client...");

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    webContents.send("update-status", "Extraindo...");

    const tempZipPath = path.join(os.tmpdir(), "Calabreso_laucher.zip");
    fs.writeFileSync(tempZipPath, buffer);

    const zip = new AdmZip(tempZipPath);
    const extractPath = path.join(os.homedir(), "Documents");
    zip.extractAllTo(extractPath, true);

    webContents.send("update-status", "Abrindo Client...");

    const miniMapResponse = await fetch(
      "https://calabreso.servegame.com/downloads/minimap800.otmm"
    );
    const miniMapArrayBuffer = await miniMapResponse.arrayBuffer();
    const miniMapBuffer = Buffer.from(miniMapArrayBuffer);
    const miniMapSavePath = path.join(
      app.getPath("appData"),
      "OTClientV8",
      "otclientv8",
      "minimap800.otmm"
    );
    fs.writeFileSync(miniMapSavePath, miniMapBuffer);

    try {
      const versionUrl =
        "https://calabreso.servegame.com/client_version/client_version.json";
      const versionResponse = await fetch(versionUrl);
      const versionData = await versionResponse.json();
      if (versionData.client_version) {
        store.set("client", { installed_version: versionData.client_version });
      }
    } catch (error) {
      webContents.send(
        "error-status",
        "Erro: Ocorreu um erro ao buscar a versão"
      );
    }

    const calabresoExePath = path.join(
      extractPath,
      "Calabreso",
      "Calabreso.exe"
    );

    store.set("client", {
      ...store.get("client"),
      instalation_path: calabresoExePath,
      installed: true,
      keepOpened: false,
      siteOpened: false,
    });

    let hasError = false;

    exec(`"${calabresoExePath}"`, (err) => {
      if (err) {
        hasError = true;
        webContents.send(
          "error-status",
          "Erro: Ocorreu um erro ao abrir o Client"
        );
        return;
      }
    });

    if (!store.get("client").keepOpened && !hasError) {
      app.quit();
    }
  } catch (error) {
    webContents.send(
      "update-status",
      "Erro: Certifique que o Client esteja fechado."
    );
  }
});

// Abrir Client
ipcMain.on("open-client", async (event) => {
  const webContents = event.sender;
  const desktopPath = path.join(
    os.homedir(),
    "Documents",
    "Calabreso",
    "Calabreso.exe"
  );
  let hasError = false;

  exec(`"${desktopPath}"`, (err) => {
    if (err) {
      hasError = true;
      webContents.send(
        "error-status",
        "Erro: Ocorreu um erro ao abrir o Client"
      );
      return;
    }
  });

  if (!store.get("client").keepOpened && !hasError) {
    app.quit();
  }
});

ipcMain.handle("getStoreValue", (event, key) => {
  return store.get(key);
});

ipcMain.on("setStoreValue", (event, key, value) => {
  store.set(key, value);
});

ipcMain.on("resize-window-to-720", () => {
  mainWindow.setSize(1280, 720);
});

ipcMain.on("resize-window-to-600", () => {
  mainWindow.setSize(800, 600);
});

ipcMain.on("load-url", (event, url) => {
  mainWindow.loadURL(url);
});

ipcMain.on("quit", () => {
  app.quit();
});

// Próximo passo é não mostrar mais o botão de instalar, somente se tiver uma atualização e o botão de Abrir calabreso
// Depois é fazer tudo automaticamente sem necessidade de botão

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
