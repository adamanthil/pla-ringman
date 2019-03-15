let pages = [...document.querySelectorAll('.page')]
let header, currentPage, i

function init() {
  pages = [...document.querySelectorAll('.page')]
  header = document.querySelector('h1')
  currentPage = 0
  i = 0
  console.info('init', pages.length, currentPage)

  header.innerHTML = pages[currentPage].dataset.label
  pages[currentPage].classList.add('display')
}

function transitionPage() {
  let finalPage = currentPage === pages.length - 1
  let nextPageIndex = finalPage ? 0 : (currentPage + 1)
  let displayedPage = pages[currentPage]
  let nextPage = pages[nextPageIndex]

  header.innerHTML = nextPage.dataset.label
  displayedPage.classList.remove('display')
  nextPage.classList.add('display')
  currentPage = nextPageIndex

  if (finalPage) i++
  if (i === 2) refreshContent(init)
}

if (pages.length) {
  init()
	window.setInterval(transitionPage, 10000)
} else {
	window.setInterval(refreshContent, 1 * 60 * 1000)
}
