export async function browserTaskRequest(message,fetcher=fetch,extensionId=globalThis.chrome?.runtime?.id) {
  let url="http://127.0.0.1:4175/api/browser";
  let options={};
  if(message.operation==="create") options={method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:message.mode,urls:message.urls})};
  else {
    if(!/^[a-f0-9-]{36}$/.test(message.jobId||"")) throw new Error("Invalid browser task.");
    url+=`/${message.jobId}`;
    if(message.operation==="cancel"){url+="/cancel";options.method="POST";}
    else if(message.operation!=="status") throw new Error("Unknown browser task operation.");
  }
  if(extensionId)options.headers={...options.headers,"X-YTMind-Extension":extensionId};
  let response;try{response=await fetcher(url,{...options,signal:AbortSignal.timeout(20000)});}catch{throw new Error("Start the local YTMind helper to run browser tasks.");}
  const data=await response.json();if(!response.ok)throw new Error(data.error||"The browser task failed.");return data;
}
