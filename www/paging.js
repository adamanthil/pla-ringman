let pages = [...document.querySelectorAll('.page')]
let count = pages.length
let currentPage = 0

function transitionPage() {
  console.log('transitioning')
  let nextPageIndex = (currentPage === count - 1) ? 0 : (currentPage + 1)
  let displayedPage = pages[currentPage]
  let nextPage = pages[nextPageIndex]

  displayedPage.classList.remove('display')
  nextPage.classList.add('display')
  currentPage = nextPageIndex
}

pages[0].classList.add('display')
console.log('init', count, currentPage)
window.setInterval(transitionPage, 10000)
