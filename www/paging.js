let pages = [...document.querySelectorAll('.page')]
let header = document.querySelector('h1')
let count = pages.length
let currentPage = 0
let i = 0

function transitionPage() {
  let finalPage = currentPage === count - 1
  let nextPageIndex = finalPage ? 0 : (currentPage + 1)
  let displayedPage = pages[currentPage]
  let nextPage = pages[nextPageIndex]

  header.innerHTML = nextPage.dataset.label
  displayedPage.classList.remove('display')
  nextPage.classList.add('display')
  currentPage = nextPageIndex

  if (finalPage) i++
  if (i === 2) window.location.reload()
}

console.info('init', count, currentPage)
if (count) {
	header.innerHTML = pages[0].dataset.label
	pages[0].classList.add('display')
	window.setInterval(transitionPage, 10000)
} else {
	window.setInterval(() => window.location.reload(), 1 * 60 * 1000)
}
