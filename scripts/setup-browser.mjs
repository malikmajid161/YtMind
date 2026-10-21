import { spawn } from "node:child_process";
const child=spawn(process.env.YTMIND_PYTHON||"python",["-m","pip","install","--target","artifacts/browser-tools","selenium==4.51.0","--disable-pip-version-check"],{windowsHide:true,stdio:"inherit"});
child.on("exit",code=>process.exitCode=code||0);
child.on("error",()=>{console.error("Python is required to install the browser tools.");process.exitCode=1;});
