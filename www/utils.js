function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  } else {
  if (document.exitFullscreen) {
    document.exitFullscreen()
  }
  }
}

function refreshContent(init) {
  fetch(window.location.href)
    .then(function(response) {
      return response.text()
    })
    .then(function(text) {
      let fragment = document.createElement('template');
      fragment.innerHTML = text

      let content = document.querySelector('.content')
      content.innerHTML = fragment.content.querySelector('.content').innerHTML
      init && init()
    })
}

document.addEventListener("keypress", function(e) {
  if (e.keyCode === 13) {
  toggleFullScreen()
  }
}, false)
