const fs=require('node:fs')
const path=require('node:path')
const {pathToFileURL}=require('node:url')
const esbuild=require('esbuild')
const sass=require('sass')
const {chromium,expect}=require('@playwright/test')
const repository=path.resolve(__dirname,'../../..')
const contents=`import React from 'react';import {createRoot} from 'react-dom/client';import Panel from './src/frontend/screens/Plugins/SourceEnginesPanel';
const mode=new URLSearchParams(location.search).get('scenario');window.__actions=[];
let state={automatic:false,checkedAt:Date.now(),engines:[{id:'scrapling',installed:'0.4.15',available:'0.4.16',upstream:'v0.4.16',enabled:true,busy:false,updateAvailable:true,upstreamUpdateAvailable:true},{id:'obscura',installed:'0.2.3',available:'0.2.4',upstream:'v0.2.4',enabled:false,busy:false,updateAvailable:true,upstreamUpdateAvailable:true}]};
if(mode==='published'){state.engines.forEach(e=>{e.available=e.installed;e.updateAvailable=false});state.catalogError='Catálogo indisponível. HTTP 404.'}
if(mode==='latest')state.engines.forEach(e=>{e.available=e.installed;e.upstream=e.installed;e.updateAvailable=false;e.upstreamUpdateAvailable=false});
if(mode==='fresh')state.engines.forEach(e=>e.installed=undefined);
if(mode==='revision')state.engines.forEach(e=>{e.available=e.installed;e.upstream=e.installed;e.upstreamUpdateAvailable=false});
if(mode==='busy')state.engines.forEach(e=>e.busy=true);
window.api={pluginsSourceEnginesState:async()=>structuredClone(state),pluginsSourceEngineAction:async action=>{window.__actions.push(action);if(action.type==='install')state.engines.forEach(e=>{if(e.id===action.id){e.installed=e.available;e.updateAvailable=false;e.upstreamUpdateAvailable=false;e.message='Motor atualizado e verificado.'}});return {success:true,state:structuredClone(state)}}};createRoot(document.getElementById('root')).render(<Panel/>);`
esbuild.buildSync({stdin:{contents,loader:'jsx',resolveDir:repository},jsx:'automatic',bundle:true,platform:'browser',outfile:path.join(__dirname,'ui.js'),tsconfig:path.join(repository,'tsconfig.json')})
const css=sass.compile(path.join(repository,'src/frontend/screens/Plugins/index.scss')).css
fs.writeFileSync(path.join(__dirname,'ui.html'),'<html lang="pt-BR"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#0d1217;color:#e6f8fa;font-family:Arial;padding:20px}'+css+'</style><p>Fixture de testes — dados simulados</p><div id="root"></div><script src="ui.js"></script></html>')
;(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true})
 try{
  const page=await browser.newPage({viewport:{width:1100,height:1000}})
  const load=async mode=>{await page.goto(pathToFileURL(path.join(__dirname,'ui.html')).href+'?scenario='+mode);await page.getByText('Motores de navegação e leitura',{exact:true}).click();await expect(page.locator('section')).toHaveCount(2)}
  await load('approved')
  for(const id of ['scrapling','obscura']){
    const section=page.locator('section').nth(id==='scrapling'?0:1)
    const update=section.getByRole('button',{name:/Instalar atualização/})
    await expect(update).toBeEnabled()
    await section.getByRole('button',{name:'Verificar instalação',exact:true}).click()
    expect(await page.evaluate(()=>window.__actions.at(-1))).toEqual({type:'verify',id})
    await update.click()
    expect(await page.evaluate(()=>window.__actions.at(-1))).toEqual({type:'install',id})
    await expect(section.getByRole('button',{name:/Instalar atualização/})).toHaveCount(0)
    await expect(section.getByText('Motor atualizado e verificado.')).toBeVisible()
  }
  await load('published')
  await expect(page.getByRole('button',{name:'Instalar atualização v0.2.4',exact:true})).toBeDisabled()
  await expect(page.getByText(/A versão v0.2.4 foi publicada/)).toBeVisible()
  await expect(page.getByText(/HTTP 404/)).toBeVisible()
  await load('latest')
  await expect(page.getByRole('button',{name:/Instalar atualização/})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Verificar instalação',exact:true})).toHaveCount(2)
  await load('fresh')
  await expect(page.getByRole('button',{name:'Instalar 0.4.16',exact:true})).toBeEnabled()
  await expect(page.getByRole('button',{name:'Instalar 0.2.4',exact:true})).toBeEnabled()
  await load('revision')
  await expect(page.getByRole('button',{name:'Instalar atualização 0.4.15',exact:true})).toBeEnabled()
  await load('busy')
  await expect(page.getByRole('button',{name:'Instalar atualização 0.2.4',exact:true})).toBeDisabled()
  await load('approved')
  await page.screenshot({path:path.join(__dirname,'updates-desktop.png'),fullPage:true})
  await page.setViewportSize({width:390,height:1000})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:path.join(__dirname,'updates-mobile.png'),fullPage:true})
  fs.writeFileSync(path.join(__dirname,'ui-result.json'),JSON.stringify({passed:true,checks:['manual install for both','verify distinct from install','published without package','already current','first installation','same-version revision','busy','390px layout']},null,2))
  console.log('PASS: actual update panel, manual actions for both engines and all availability states; desktop and 390px.')
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})
