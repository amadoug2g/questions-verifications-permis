let _sheet, _backdrop, _frame

function _ensure() {
  if (_sheet) return
  _backdrop = document.createElement('div')
  _backdrop.className = 'vsheet-backdrop'
  _sheet = document.createElement('div')
  _sheet.className = 'vsheet'
  _sheet.innerHTML = `<div class="vsheet-grab"></div><div class="vsheet-frame"></div>`
  _frame = _sheet.querySelector('.vsheet-frame')
  document.body.append(_backdrop, _sheet)
  _backdrop.addEventListener('click', closeVideoSheet)
  window.addEventListener('keydown', e => { if (e.key === 'Escape') closeVideoSheet() })
}

function _embedSrc(url) {
  const tt = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/)
  if (tt) return `https://www.tiktok.com/embed/v2/${tt[1]}`
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&playsinline=1`
  return null
}

export function openVideoSheet(url) {
  _ensure()
  const src = _embedSrc(url)
  if (!src) return
  const kind = /tiktok\.com/.test(url) ? 'tiktok' : 'youtube'
  _frame.className = `vsheet-frame ${kind}`
  _frame.innerHTML = `
    <iframe src="${src}" allow="autoplay; encrypted-media; fullscreen"
      allowfullscreen loading="lazy"></iframe>
    <a class="vsheet-link" href="${url}" target="_blank" rel="noopener noreferrer">
      Ouvrir sur ${kind === 'tiktok' ? 'TikTok' : 'YouTube'} ↗
    </a>
  `
  document.body.classList.add('sheet-open')
  requestAnimationFrame(() => {
    _backdrop.classList.add('open')
    _sheet.classList.add('open')
  })
}

export function closeVideoSheet() {
  if (!_sheet) return
  _sheet.classList.remove('open')
  _backdrop.classList.remove('open')
  document.body.classList.remove('sheet-open')
  setTimeout(() => { if (_frame) _frame.innerHTML = '' }, 300)
}
