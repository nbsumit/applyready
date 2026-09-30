/* Browser task checks against the real static app; no mock rendering or services. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const { resumeFixture } = require('./fixtures');
const { TEMPLATES } = require('../js/templates');
const { checkLongDocuments } = require('./document_checks');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.QA_OUTPUT_DIR || path.join(root, 'test-results'));
fs.mkdirSync(output, { recursive: true });
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.txt':'text/plain', '.xml':'application/xml', '.webmanifest':'application/manifest+json' };
let checks=0;
const ok = (condition,message) => { assert(condition,message); checks++; };
const server = http.createServer((req,res) => {
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file,(error,data) => {
    res.writeHead(error ? 404 : 200, {'Content-Type':error ? 'text/html' : mime[path.extname(file)] || 'application/octet-stream'});
    res.end(error ? fs.readFileSync(path.join(root,'404.html')) : data);
  });
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true, ...(process.env.BROWSER_EXECUTABLE_PATH ? {executablePath:process.env.BROWSER_EXECUTABLE_PATH} : {}), args:['--no-sandbox','--disable-dev-shm-usage']});
  const errors=[], external=[];
  const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'light',acceptDownloads:true});
  await context.route('**/*', route=>{ const url=route.request().url(); if(url.startsWith(origin) || /^(blob:|data:)/.test(url)) return route.continue(); external.push(url); return route.abort(); });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  let dialogAction='dismiss'; const dialogs=[];
  page.on('dialog',d=>{dialogs.push(d.message()); return d[dialogAction]();});
  const visit=async file=>{await page.goto(`${origin}/${file}`);await page.evaluate(()=>document.fonts.ready);};
  const overflow=async()=>page.evaluate(()=>document.documentElement.scrollWidth > innerWidth+1);
  const audit=async label=>{
    // Audit the settled theme rather than an intermediate transition frame.
    await page.waitForTimeout(250);
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
    fs.writeFileSync(path.join(output,`axe-${label}.json`),JSON.stringify(result.violations,null,2));
    ok(result.violations.length===0,`${label}: accessibility violations: ${result.violations.map(x=>x.id).join(', ')}`);
  };
  for(const file of ['index.html','resume.html']) {
    for(const theme of ['light','dark']) {
      await visit(file); const desired=theme;
      if(await page.evaluate(()=>document.documentElement.dataset.theme)!==desired)await page.locator('#themeToggle').click();
      for(const width of [320,360,390,768,1024,1366,1440,1920]) {
        await page.setViewportSize({width,height:900});
        ok(!await overflow(),`${file}/${theme}/${width}: page overflows`);
        if(file==='resume.html' && width<950) {
          await page.locator('#tabPreview').click();
          ok(!await overflow(),`Resume preview overflows at ${width}`);
          const bounds=await page.evaluate(()=>{const sheet=document.querySelector('#resumeVisualPages .resume-visual-page').getBoundingClientRect(),outer=document.getElementById('resumePreviewOuter').getBoundingClientRect();return {left:sheet.left,right:sheet.right,outerLeft:outer.left,outerRight:outer.right};});
          ok(bounds.left>=bounds.outerLeft-1 && bounds.right<=bounds.outerRight+1,`Visible resume paper is clipped at ${width}`);
          await page.locator('#tabEdit').click();
        }
        if([320,1440].includes(width))await page.screenshot({path:path.join(output,`${file}-${theme}-${width}.png`),fullPage:true});
      }
      await page.setViewportSize({width:1440,height:1000});
      ok(await page.locator('#themeToggle i.fa-circle-half-stroke').count()===1,`${file}/${theme}: neutral theme icon is rendered`);
      await audit(`${file}-${theme}`);
    }
  }
  console.log('✓ Responsive layouts, both themes, and initial accessibility');
  await visit('index.html');
  ok(await page.locator('#btnOriginalSize').isDisabled(), 'Original size requires a decoded source');
  await page.locator('[data-preset="passport"]').click();
  ok(await page.locator('#presetSelect').inputValue()==='passport', 'Quick photo preset updates the selected preset');
  ok(await page.locator('#customWidth').isVisible(), 'Preset dimensions remain editable');
  await page.locator('#presetSelect').selectOption('custom');
  await page.locator('#customWidth').fill('700');
  ok(await page.locator('#customHeight').inputValue()==='900', 'Switching from a portrait preset to custom retains its ratio');
  await page.locator('[data-preset="signature"]').click();
  await page.locator('#customWidth').fill('600');
  ok(await page.locator('#presetSelect').inputValue()==='custom', 'Editing preset dimensions switches to custom');
  ok(await page.locator('#customHeight').inputValue()==='200', 'Editing a preset retains its ratio');
  ok(await page.locator('[data-preset="signature"]').getAttribute('aria-pressed')==='false', 'Edited preset is no longer announced as active');
  await page.locator('#btnTryExample').click();
  await page.waitForFunction(()=>!document.getElementById('btnOriginalSize').disabled);
  ok((await page.locator('#fileInfoText').textContent()).includes('sample_document.png'), 'Sample document loads without a remote upload');
  await page.locator('#btnOriginalSize').click();
  ok(await page.locator('#customWidth').inputValue()==='960' && await page.locator('#customHeight').inputValue()==='1200', 'Original dimensions are restored');
  const fullCrop=await page.evaluate(()=>document.getElementById('imageToCrop').cropper.getData());
  ok(Math.abs(fullCrop.x)<1 && Math.abs(fullCrop.y)<1 && Math.abs(fullCrop.width-960)<1 && Math.abs(fullCrop.height-1200)<1, 'Original size selects the full source without clipping');
  await page.locator('#customMaxKB').fill('200');await page.locator('#btnProcess').click();await page.locator('#resultArea').waitFor({state:'visible'});
  const originalResult=await page.evaluate(async()=>{const blob=await fetch(document.getElementById('btnDownload').href).then(r=>r.blob());const img=await createImageBitmap(blob);return {w:img.width,h:img.height,bytes:blob.size};});
  ok(originalResult.w===960 && originalResult.h===1200 && originalResult.bytes<=200*1024, 'Original-size compression verifies the output dimensions and byte limit');
  ok(await page.locator('#workspaceStatus').textContent()==='Ready to download', 'Workspace status reflects successful processing');
  await page.locator('#btnRemoveFile').click();
  ok(await page.locator('#btnOriginalSize').isDisabled() && await page.locator('#cropperPlaceholder').isVisible(), 'Removing the source restores a usable upload state');
  console.log('✓ Editable quick presets, aspect-ratio regression, local demo, and full-image compression');
  await visit('resume.html');
  await page.locator('#fullName').fill('Jordan Lee');
  await page.locator('#btnUndo').click();ok(await page.locator('#fullName').inputValue()==='', 'Typing undo restores previous text');
  await page.locator('#btnRedo').click();ok(await page.locator('#fullName').inputValue()==='Jordan Lee', 'Typing redo restores text');
  await page.locator('#email').fill('jordan@example.com');
  await page.locator('.draft-options > summary').click();
  await page.locator('#chkSaveDraft').check();
  await page.locator('#tabDesign').click();await page.locator('#pageSizeSelect').selectOption('letter');await page.locator('#fontSelect').selectOption('sans');
  await page.reload();ok(await page.locator('#fullName').inputValue()==='Jordan Lee','Consented draft restores after reload');
  await page.locator('#tabDesign').click();ok(await page.locator('#pageSizeSelect').inputValue()==='letter','Restored design selector agrees with saved paper size');
  ok(await page.locator('#fontSelect').inputValue()==='sans','Restored typography selector agrees with saved draft');
  await page.locator('#tabContent').click();
  const nameBefore=await page.locator('#fullName').inputValue();const dialogCount=dialogs.length;
  await page.locator('#btnLoadSample').click();ok(dialogs.length===dialogCount+1,'Replacing an existing draft requires an explicit decision');
  ok(await page.locator('#fullName').inputValue()===nameBefore,'Canceling sample replacement preserves content');
  await page.locator('.draft-options > summary').click();
  await page.locator('#fileImportInput').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:2,data:{personal:{fullName:[]},experience:[],education:[],projects:[]}}))});
  await page.locator('#taskNotification').filter({hasText:'Could not import'}).waitFor();
  ok(await page.locator('#fullName').inputValue()===nameBefore,'Malformed backup cannot erase or crash the current resume');
  const fixture=resumeFixture();dialogAction='accept';
  await page.locator('#fileImportInput').setInputFiles({name:'resume.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:2,app:'ApplyReady',data:fixture}))});
  await page.waitForFunction(()=>document.getElementById('resumeSheet').textContent.includes('GRANT_MARKER'));
  ok(await page.locator('#fullName').evaluate(el=>el===document.activeElement), 'Restoring a backup focuses its contact details');
  ok(await page.locator('#fullName').evaluate(el=>el.getBoundingClientRect().top>=document.querySelector('.navbar').getBoundingClientRect().bottom), 'Restored contact fields are clear of the sticky navigation');
  for(const marker of ['VOLUNTEER_MARKER','LANGUAGE_MARKER','PUBLICATION_MARKER','TEACHING_MARKER','PRESENTATION_MARKER','GRANT_MARKER'])ok((await page.locator('#resumeSheet').textContent()).includes(marker),`Preview includes ${marker}`);
  await audit('resume-with-optional-sections');
  for(const [template,config] of Object.entries(TEMPLATES)) {
    await page.locator('#tabDesign').click();await page.locator(`[data-template-id="${template}"] .btn-select-template`).click();
    ok((await page.locator('#resumeSheet').textContent()).includes('GRANT_MARKER'),`${template}: template switch preserves optional content`);
    ok(await page.getByRole('button',{name:'Full preview of '+config.name,exact:true}).count()===1,`${template}: preview has an unambiguous accessible name`);
    ok(await page.getByRole('button',{name:'Use '+config.name+' template',exact:true}).getAttribute('aria-pressed')==='true',`${template}: selected template is announced`);
    const download=page.waitForEvent('download');await page.locator('#btnQuickPDF').click();const file=await download;const filename=path.join(output,`${template}.pdf`);await file.saveAs(filename);
    const text=execFileSync('pdftotext',[filename,'-'],{encoding:'utf8'});
    for(const marker of ['VOLUNTEER_MARKER','LANGUAGE_MARKER','PUBLICATION_MARKER','TEACHING_MARKER','GRANT_MARKER'])ok(text.includes(marker),`${template}: actual PDF extraction lost ${marker}`);
    const bbox=execFileSync('pdftotext',['-bbox',filename,'-'],{encoding:'utf8'});
    for(const match of bbox.matchAll(/<word xMin="([\d.-]+)" yMin="([\d.-]+)" xMax="([\d.-]+)" yMax="([\d.-]+)"/g))ok(+match[1]>=20 && +match[3]<=590 && +match[2]>=10 && +match[4]<=832,`${template}: text falls outside safe paper bounds`);
    const info=execFileSync('pdfinfo',[filename],{encoding:'utf8'});const pages=Number(info.match(/Pages:\s+(\d+)/)[1]);ok((await page.locator('#pageCountPill').textContent()).startsWith(String(pages)),'Displayed PDF page count agrees with downloaded file');
    const visiblePages=await page.locator('#resumeVisualPages .resume-visual-page').count();ok(visiblePages===pages,`${template}: visible preview page count agrees with downloaded PDF (${visiblePages} preview vs ${pages} PDF)`);
    ok(await page.locator('#resumeVisualPages .resume-visual-page').evaluateAll(nodes=>nodes.every(node=>node.scrollHeight<=node.clientHeight+2)),`${template}: visible preview pages do not overflow their paper bounds`);
    ok(await page.locator('#resumeSheet').evaluate(el=>getComputedStyle(el).visibility==='hidden'),`${template}: export source remains hidden on screen`);
  }
  // Modal controls and focus restoration on the phone-sized gallery.
  await page.setViewportSize({width:320,height:800});await page.locator('#tabEdit').click();await page.locator('#tabDesign').click();
  const preview=page.locator('.btn-preview-template').first();await preview.click();
  ok(await page.locator('#templatePreviewModal').isVisible(),'Template preview opens');
  ok(await page.locator('#mainContent').evaluate(el=>el.inert),'Background is inert while modal is open');
  await page.locator('#btnCloseTmplModal').press('Shift+Tab');ok(await page.locator('#btnUseTmplModal').evaluate(el=>el===document.activeElement),'Modal focus wraps backwards');
  await page.locator('#btnUseTmplModal').press('Tab');ok(await page.locator('#btnCloseTmplModal').evaluate(el=>el===document.activeElement),'Modal focus wraps forwards');
  ok(!await page.locator('.template-preview-modal-body').evaluate(el=>el.scrollWidth>el.clientWidth+1),'Full template preview fits the phone');
  await page.locator('#btnCloseTmplModal').press('Escape');ok(await preview.evaluate(el=>el===document.activeElement),'Closing modal restores the trigger focus');
  await page.setViewportSize({width:1440,height:1000});await page.locator('#tabReview').click();
  for(const [button,ext] of [['btnDownloadDOCX','docx'],['btnDownloadText','txt']]) {
    const download=page.waitForEvent('download');await page.locator('#'+button).click();const file=await download;const target=path.join(output,`resume.${ext}`);await file.saveAs(target);
    if(ext==='docx'){execFileSync('unzip',['-t',target]);const xml=execFileSync('unzip',['-p',target,'word/document.xml'],{encoding:'utf8'});ok(xml.includes('GRANT_MARKER') && xml.includes('VOLUNTEER_MARKER'),'Downloaded Word archive retains all optional content');}
    else ok(fs.readFileSync(target,'utf8').includes('GRANT_MARKER'),'Downloaded plain text retains all optional content');
  }
  // Unicode uses browser print, avoiding silent loss from the standard PDF fonts.
  await page.locator('#tabContent').click();await page.locator('#fullName').fill('सुमित');
  await page.evaluate(()=>{window.print=()=>{window.__printCalled=true;};});
  await page.locator('#btnQuickPDF').click();await page.waitForFunction(()=>window.__printCalled);ok(await page.evaluate(()=>window.__printCalled),'Unicode PDF uses browser print to preserve the characters');
  ok((await page.locator('#resumeSheet').textContent()).includes('सुमित'),'Unicode is preserved in preview');
  const unicodePdf=path.join(output,'unicode-browser.pdf');await page.pdf({path:unicodePdf,preferCSSPageSize:true});
  ok(execFileSync('pdftotext',[unicodePdf,'-'],{encoding:'utf8'}).includes('सुमित'),'Browser PDF contains selectable Unicode text');
  console.log('✓ Draft recovery, malformed imports, all templates, PDF/Word/text downloads, and modal focus');

  await visit('index.html');await page.setViewportSize({width:390,height:844});
  const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d'),pixels=x.createImageData(512,512);let seed=17;for(let i=0;i<pixels.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;pixels.data[i]=seed&255;pixels.data[i+1]=(seed>>8)&255;pixels.data[i+2]=(seed>>16)&255;pixels.data[i+3]=255;}x.putImageData(pixels,0,0);x.clearRect(220,220,72,72);return c.toDataURL('image/png').split(',')[1];});
  await page.locator('#fileInput').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
  await page.locator('#btnProcess').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('btnProcess').disabled);
  await page.locator('#presetSelect').selectOption('avatar');await page.locator('#btnProcess').click();await page.locator('#resultArea').waitFor({state:'visible'});
  const result=await page.evaluate(async()=>{const blob=await fetch(document.getElementById('btnDownload').href).then(r=>r.blob());const img=await createImageBitmap(blob);return {bytes:blob.size,type:blob.type,w:img.width,h:img.height};});
  ok(result.w===400 && result.h===400 && result.bytes<=102400 && result.type==='image/jpeg','JPEG matches measured pixel dimensions, bytes, and MIME');
  await audit('image-result-dark');
  await page.locator('#themeToggle').click();await audit('image-result-light');
  const priorDialogs=dialogs.length;for(let i=0;i<2;i++){const d=page.waitForEvent('download');await page.locator('#btnDownload').click();await (await d).saveAs(path.join(output,`image-${i}.jpg`));}ok(dialogs.length===priorDialogs,'Repeated image exports do not trigger popups');
  await page.locator('.advanced-disclosure > summary').click();
  await page.locator('#addDateCheckbox').check();await page.locator('#candidateNameInput').fill('सुमित');
  const ratio=await page.evaluate(()=>{const data=document.getElementById('imageToCrop').cropper.getData();return data.width/data.height;});
  ok(Math.abs(ratio-400/336)<.02,'Annotation crop matches the photo area instead of stretching the source');
  await page.locator('#btnProcess').click();await page.locator('#resultArea').waitFor({state:'visible'});
  ok((await page.locator('#resultDims').textContent()).startsWith('400 × 400'),'Annotated output retains exact dimensions');
  await page.locator('#addDateCheckbox').uncheck();
  const surface=page.locator('.cropper-container-wrapper');const leftBefore=await page.evaluate(()=>document.getElementById('imageToCrop').cropper.getCropBoxData().left);
  await surface.press('ArrowRight');ok(await page.evaluate(()=>document.getElementById('imageToCrop').cropper.getCropBoxData().left)>=leftBefore,'The crop can be adjusted with a keyboard');
  await page.locator('#presetSelect').selectOption('custom');
  ok(await page.locator('#cropperActiveArea').isVisible(),'Editing settings returns from result to the crop workspace');
  await page.locator('#formatSelect').selectOption('image/png');await page.locator('#customMaxKB').fill('5');await page.locator('#btnProcess').click();await page.locator('#processErrorBox').waitFor({state:'visible'});
  ok(!await page.locator('#resultArea').isVisible(),'An oversized PNG cannot be reported as a successful download');
  await page.locator('#customMaxKB').fill('20000');await page.locator('#btnProcess').click();await page.locator('#resultArea').waitFor({state:'visible'});
  const alpha=await page.evaluate(async()=>{const blob=await fetch(document.getElementById('btnDownload').href).then(r=>r.blob());const img=await createImageBitmap(blob);const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return ctx.getImageData(Math.floor(img.width/2),Math.floor(img.height/2),1,1).data[3];});
  ok(alpha===0,'PNG preserves source transparency');
  await page.locator('#formatSelect').selectOption('image/webp');await page.locator('#customMaxKB').fill('50');await page.locator('#btnProcess').click();await page.locator('#resultArea').waitFor({state:'visible'});
  ok((await page.locator('#resultFormat').textContent())==='WebP','WebP processing succeeds under a real file limit');
  await page.locator('#customWidth').fill('999999');ok(await page.locator('#btnProcess').isDisabled(),'Invalid dimensions disable processing');ok(await page.locator('#customWidth').getAttribute('aria-invalid')==='true','Invalid dimensions are identified for assistive technology');
  await page.locator('#customWidth').fill('400');
  // Slow a real encoding operation, then change its settings before it completes.
  await page.evaluate(()=>{const native=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(cb,...args){return native.call(this,blob=>setTimeout(()=>cb(blob),80),...args);};});
  await page.locator('#btnProcess').click();await page.locator('#customMaxKB').fill('70');await page.waitForTimeout(1000);
  ok(!await page.locator('#resultArea').isVisible(),'Changed settings cancel a pending result');ok(!await page.locator('#btnProcess').isDisabled(),'Canceled encoding leaves a working process button');
  await page.locator('#btnRemoveFile').click();await page.locator('#fileInput').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('not an image')});await page.locator('#processErrorBox').waitFor({state:'visible'});
  ok(await page.locator('#btnProcess').isDisabled(),'A corrupt source never becomes a processable image');
  await page.setViewportSize({width:320,height:800});await page.locator('#navMenuToggle').click();ok(await page.locator('#navMenuToggle').getAttribute('aria-expanded')==='true','Mobile navigation opens');await page.locator('#navMenuToggle').press('Escape');ok(await page.locator('#navMenuToggle').getAttribute('aria-expanded')==='false','Escape closes mobile navigation');
  console.log('✓ Strict image sizes, transparency, repeat downloads, corrupt sources, canceled jobs, and mobile navigation');
  for(const file of ['about.html','privacy.html','how-to-use.html','404.html','guides/ats-friendly-resume-guide.html','guides/image-dimensions-vs-file-size.html','guides/image-formats-guide.html','guides/compression-targets-guide.html']) {await visit(file);ok(!await overflow(),`${file} fits at 320px`);}
  await visit('nested/missing-page');
  ok((await page.title()).includes('404'), 'Deep missing routes display the recovery page');
  ok(await page.locator('.navbar .brand-logo').getAttribute('href')==='/index.html','404 navigation resolves from nested missing routes');
  ok((await page.locator('body').evaluate(el=>getComputedStyle(el).fontFamily)).includes('Inter'), '404 assets load from nested missing routes');
  ok(!await overflow(), 'Nested recovery page fits a phone');
  await audit('404-phone');
  ok(external.length===0,`Unexpected third-party requests: ${external.join(', ')}`);
  ok(errors.length===0,`Browser errors: ${errors.join(', ')}`);
  ok(checkLongDocuments(output)===32, 'All templates retain long content inside both paper sizes and font families');
  console.log(`\n${checks} browser assertions passed. Screenshots and real downloads: ${output}`);
  await browser.close();await new Promise(resolve=>server.close(resolve));
})().catch(error=>{console.error(error);server.close();process.exit(1);});
