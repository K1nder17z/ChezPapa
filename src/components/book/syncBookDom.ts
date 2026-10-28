const boundButtons = new WeakSet<HTMLButtonElement>()
const boundStars = new WeakSet<HTMLAnchorElement>()
const boundOrderLinks = new WeakSet<HTMLAnchorElement>()

function keepGesture(node: HTMLElement) {
  const stop = (event: Event) => event.stopPropagation()
  node.addEventListener('pointerdown', stop)
  node.addEventListener('mousedown', stop)
  node.addEventListener('touchstart', stop, { passive: true })
}

export function bindCartButtons(root: ParentNode) {
  root.querySelectorAll('button[data-cart]').forEach((node) => {
    if (!(node instanceof HTMLButtonElement) || boundButtons.has(node)) return
    boundButtons.add(node)
    keepGesture(node)
  })
  root.querySelectorAll('a[data-google-star]').forEach((node) => {
    if (!(node instanceof HTMLAnchorElement) || boundStars.has(node)) return
    boundStars.add(node)
    keepGesture(node)
  })
  root.querySelectorAll('a[data-order-go]').forEach((node) => {
    if (!(node instanceof HTMLAnchorElement) || boundOrderLinks.has(node)) return
    boundOrderLinks.add(node)
    keepGesture(node)
  })
}

export function syncBookDom() {
  const source = document.querySelector('.book-source')
  const host = document.querySelector('.book-host')
  if (!source || !host) return
  const hostArticles = [...host.querySelectorAll('article[data-sheet]')]
  source.querySelectorAll('article[data-sheet]').forEach((sourceArticle) => {
    const id = sourceArticle.getAttribute('data-sheet')
    const hostArticle = hostArticles.find((article) => article.getAttribute('data-sheet') === id)
    if (!hostArticle || !id) return
    if (id === 'order') {
      if (hostArticle.innerHTML !== sourceArticle.innerHTML) hostArticle.innerHTML = sourceArticle.innerHTML
      return
    }
    copyNamed(sourceArticle, hostArticle, '[data-buy]', 'data-buy', (sourceNode, target) => {
      if (target.className !== sourceNode.className) target.className = sourceNode.className
    })
    copyNamed(sourceArticle, hostArticle, '[data-qty]', 'data-qty', (sourceNode, target) => {
      if (target.textContent !== sourceNode.textContent) target.textContent = sourceNode.textContent
    })
    copyNamed(sourceArticle, hostArticle, '[data-sup-qty]', 'data-sup-qty', (sourceNode, target) => {
      if (target.textContent !== sourceNode.textContent) target.textContent = sourceNode.textContent
    })
    copyNamed(sourceArticle, hostArticle, '[data-extra]', 'data-extra', (sourceNode, target) => {
      if (sourceNode instanceof HTMLElement && target instanceof HTMLElement && target.hidden !== sourceNode.hidden) {
        target.hidden = sourceNode.hidden
      }
    })
    sourceArticle.querySelectorAll('button[data-cart]').forEach((sourceNode) => {
      if (!(sourceNode instanceof HTMLButtonElement)) return
      const action = sourceNode.getAttribute('data-cart')
      const dish = sourceNode.getAttribute('data-dish')
      const target = hostArticle.querySelector(`button[data-cart="${action}"][data-dish="${dish}"]`)
      if (target instanceof HTMLButtonElement && target.disabled !== sourceNode.disabled) {
        target.disabled = sourceNode.disabled
      }
    })
  })
  bindCartButtons(host)
}

function copyNamed(
  source: Element,
  host: Element,
  selector: string,
  attribute: string,
  apply: (sourceNode: Element, target: Element) => void,
) {
  source.querySelectorAll(selector).forEach((sourceNode) => {
    const value = sourceNode.getAttribute(attribute)
    if (!value) return
    const target = host.querySelector(`[${attribute}="${CSS.escape(value)}"]`)
    if (target) apply(sourceNode, target)
  })
}
