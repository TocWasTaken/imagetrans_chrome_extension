document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('mobilePreset').addEventListener('click',()=>{
    for(const [id,value] of Object.entries({ocrMethod:'mobile',translationMode:'local',openaiURL:'https://openrouter.ai/api/v1',openaiModel:'tencent/hy-mt2-7b',openaiPrompt:MobileCommon.PROMPT,openaiExtraParams:''}))document.getElementById(id).value=value;
    document.getElementById('useOpenAI').checked=true;
    document.getElementById('sourceLangSelect').value='ko';
    document.getElementById('targetLangSelect').value='en';
    document.getElementById('ocrMethodSection').style.display='block';
    alert('Preset selected. Paste your OpenRouter API key and tap Save.');
  });
});
