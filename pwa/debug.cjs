const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Capturar console.log e erros
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log("Acessando http://127.0.0.1:8080...");
  await page.goto('http://127.0.0.1:8080');

  // Aguardar 2 segundos para inicialização
  await new Promise(r => setTimeout(r, 2000));
  
  // Tentar clicar no botão Cadastrar
  await page.click('#btn-abrir-enroll');
  await new Promise(r => setTimeout(r, 500));

  // Preencher nome, matricula, lgpd e clicar em capturar
  await page.type('#nome', 'teste');
  await page.type('#matricula', '123');
  await page.click('#lgpd-consent');
  await page.click('#btn-capturar');

  // Aguardar um pouco para o erro aparecer
  await new Promise(r => setTimeout(r, 1000));

  // Ler o erro
  const errText = await page.$eval('#enroll-status', el => el.innerText);
  console.log("ENROLL STATUS TEXT:", errText);

  await browser.close();
})();
