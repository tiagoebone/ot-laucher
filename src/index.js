const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { exec } = require("child_process");
const os = require("os");
const AdmZip = require("adm-zip");
const fs = require("fs");

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "index.html"));

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
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

ipcMain.on("open-calabreso", () => {
  const desktopPath = path.join(
    os.homedir(),
    "Desktop",
    "Calabreso V2",
    "Calabreso.exe"
  );
  exec(`"${desktopPath}"`, (err) => {
    if (err) {
      console.error("Erro ao abrir Calabreso.exe:", err);
      return;
    }
    console.log("Calabreso.exe aberto com sucesso");
  });
});

function moveFiles(srcDir, destDir) {
  fs.readdirSync(srcDir).forEach((file) => {
    const srcFile = path.join(srcDir, file);
    const destFile = path.join(destDir, file);
    fs.renameSync(srcFile, destFile);
  });
}

ipcMain.on("install-calabreso", async () => {
  try {
    const fetch = (...args) =>
      import("node-fetch").then(({ default: fetch }) => fetch(...args));
    const url = "https://calabreso.servegame.com/downloads/Calabreso_V2.zip";

    console.log("Baixando");

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("Extraindo");

    const tempZipPath = path.join(os.tmpdir(), "Calabreso_V2.zip");
    fs.writeFileSync(tempZipPath, buffer);

    const zip = new AdmZip(tempZipPath);
    const extractPath = path.join(os.homedir(), "Documents", "Calabreso V2");
    zip.extractAllTo(extractPath, true);

    const subFolder = path.join(extractPath, "Calabreso V2");
    if (fs.existsSync(subFolder)) {
      moveFiles(subFolder, extractPath);
      fs.rmdirSync(subFolder); // Remover a subpasta vazia
    }

    console.log("Calabreso instalado com sucesso");
    console.log("Abrindo Calabreso.exe");
    const calabresoExePath = path.join(extractPath, "Calabreso.exe");
    exec(`"${calabresoExePath}"`, (err) => {
      if (err) {
        console.error("Erro ao abrir Calabreso.exe:", err);
        return;
      }
      console.log("Calabreso.exe aberto com sucesso");
    });
  } catch (error) {
    console.error("Erro ao instalar Calabreso:", error);
  }
});

// Proximo passo é mostrar os console.logs dentro de uma div
// Depois não mostrar mais o botão de instalar, somente se tiver uma atualização

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
