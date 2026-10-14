import http from 'node:http';

export async function startFixture({ scenarios = {}, answer = 'LOCAL FIXTURE ONLY: Example Restaurant is a synthetic candidate. This is not a real AI answer.' } = {}) {
  const server = http.createServer((req, res) => {
    const platform = req.url.startsWith('/gemini') ? 'gemini' : 'chatgpt';
    const scenario = scenarios[platform] ?? 'success';
    const model = platform === 'chatgpt' ? 'data-testid="model-switcher-dropdown-button"' : 'data-test-id="bard-mode-menu-button"';
    const auth = platform === 'chatgpt' ? 'data-testid="accounts-profile-button"' : 'aria-label="Google Account: Fixture"';
    const editor = platform === 'chatgpt' ? '<div id="prompt-textarea" contenteditable="true" role="textbox"></div>' : '<rich-textarea><div contenteditable="true" role="textbox"></div></rich-textarea>';
    const body = scenario === 'login' ? '<h2>Log in to continue</h2>' : scenario === 'captcha' ? '<h2>Verify you are human</h2>' : scenario === 'quota' ? '<h2>You have reached your usage limit. Try again tomorrow.</h2>' : `${scenario === 'anonymous' ? '' : `<button ${auth}>Fixture account</button>`}<button ${model}>Fixture default</button><main id="messages"></main>${editor}`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>LOCAL FIXTURE ONLY</title><style>body{font:18px/1.6 sans-serif;max-width:900px;margin:40px auto}header{background:#ffe5a8;padding:20px}button{padding:10px;margin:12px}main>div,model-response,user-query{display:block;background:#eef3f6;padding:20px;margin:20px 0}[contenteditable]{min-height:70px;border:2px solid #668;padding:14px}</style><header>LOCAL FIXTURE ONLY — NOT A LIVE AI RESPONSE</header>${body}<script>
      const platform=${JSON.stringify(platform)}, scenario=${JSON.stringify(scenario)}, answer=${JSON.stringify(answer).replace(/</g, '\\u003c')};
      const editor=document.querySelector('[contenteditable]');
      if(scenario==='stale') { const e=document.createElement(platform==='gemini'?'model-response':'div');if(platform==='chatgpt')e.dataset.messageAuthorRole='assistant';e.textContent='Old conversation';document.querySelector('main').append(e); }
      if(editor)editor.addEventListener('keydown',event=>{if(event.key!=='Enter'||event.shiftKey)return;event.preventDefault();const prompt=editor.innerText;editor.innerText='';const user=document.createElement(platform==='gemini'?'user-query':'div');if(platform==='chatgpt')user.dataset.messageAuthorRole='user';user.textContent=prompt;document.querySelector('main').append(user);const stop=document.createElement('button');stop.setAttribute('aria-label',platform==='gemini'?'Stop response':'Stop generating');stop.textContent='Stop';document.body.append(stop);if(scenario==='timeout')return;const response=document.createElement(platform==='gemini'?'model-response':'div');if(platform==='chatgpt')response.dataset.messageAuthorRole='assistant';response.textContent='Working';document.querySelector('main').append(response);setTimeout(()=>{response.textContent=answer;const link=document.createElement('a');link.href='https://example.org/fixture-menu';link.textContent='Synthetic source';response.append(document.createElement('br'),link);stop.remove()},180)});
    </script></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}
