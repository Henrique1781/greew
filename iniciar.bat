@echo off
title GREEN - Analise Esportiva
cd /d "%~dp0"
start "" http://localhost:5173
node tools\serve.js 5173
