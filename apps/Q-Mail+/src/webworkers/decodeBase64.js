self.addEventListener('message', async (event) => {
  //

  // const qortalRequest = event.data.qortalRequest
  // const name = event.data.name
  // const service = event.data.service
  // const identifier = event.data.identifier

  // const url2 = `/arbitrary/VIDEO/crowetic/q-blog-video-xGR8HP?&encoding=base64`
  // const res = await fetch(url2);
  // const data = await res.text();
  // self.postMessage(data);
  const url2 = `/arbitrary/VIDEO/crowetic/q-blog-video-xGR8HP`

  const xhr = new XMLHttpRequest()
  xhr.open('GET', url2, true)
  xhr.responseType = 'blob'
  xhr.onload = () => {
    const headers = xhr.getAllResponseHeaders()
    const blob = xhr.response
    const url = URL.createObjectURL(blob)
    const byteLength = blob.size
    const contentRange = `bytes 0-${byteLength}/${byteLength}`
    const contentType = xhr.getResponseHeader('Content-Type')
    self.postMessage(url)
    // this.dispatchEvent(new CustomEvent('loaded', { detail: { headers, byteLength, contentRange, contentType } }));
  }
  xhr.send()
  // fetch(url2)
  //   .then(response => response.blob())
  //   .then(blob => {
  //     

  //     // Create a new Blob with the 'video/mp4' MIME type
  //     const mp4Blob = new Blob([blob], { type: 'video/mp4' });
  //     

  //     // Generate an object URL from the new Blob
  //     const url = URL.createObjectURL(mp4Blob);
  //     self.postMessage(url);
  //   })
  //   .catch(error => console.error(error));
  // const response = await fetch(url2, {
  //   method: 'GET'
  // })
  // 
  // const responseData = await response.json()
  // 
  // const base64Data = responseData
  // const decodedData = atob(base64Data);
  // const byteNumbers = new Array(decodedData.length);

  // for (let i = 0; i < decodedData.length; i++) {
  //   byteNumbers[i] = decodedData.charCodeAt(i);
  // }

  // const byteArray = new Uint8Array(byteNumbers);
  // const blob = new Blob([byteArray], { type: 'video/mp4' });
  // const url = URL.createObjectURL(blob);

  // self.postMessage(url);
})
