const requested = new URLSearchParams(location.search).get('state') || 'dialog';
const kind = ['dialog', 'popover', 'overlay'].includes(requested) ? requested : 'dialog';
const popup = document.createElement(kind === 'dialog' ? 'dialog' : 'section');
popup.className = 'letter-popup';
popup.id = 'letter-popup';
popup.dataset.layer = kind;
popup.dataset.reviewId = 'letter-popup';
popup.setAttribute('aria-labelledby', 'letter-title');
if (kind === 'popover') popup.setAttribute('popover', 'auto');
if (kind === 'overlay') {
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-modal', 'true');
}
popup.innerHTML = `
  <button class="letter-close" type="button" id="close-letter" data-review-id="close-letter" aria-label="关闭来信弹窗">×</button>
  <p class="eyebrow" data-review-id="letter-kicker">A LETTER FROM THE WILD</p>
  <h2 id="letter-title" data-review-id="letter-title">把山野，寄给你。</h2>
  <p class="letter-copy" data-review-id="letter-description">每月一次，分享工作室的新作与生活手记。<br/>不催促，不打扰，留给你慢慢读。</p>
  <form id="letter-form">
    <label for="letter-email" data-review-id="letter-email-label">你的邮箱<input id="letter-email" data-review-id="letter-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required/></label>
    <button class="button primary" data-review-id="letter-subscribe" type="submit">订阅来信</button>
  </form>
  <p class="letter-note" data-review-id="letter-note">只发送山野来信，随时可以取消订阅。</p>
  <p class="letter-success" id="letter-success" data-review-id="letter-success" role="status" hidden>已为你留好位置，期待下一封来信。</p>`;
const scrim = document.createElement('div');
scrim.className = 'letter-scrim';
scrim.hidden = true;
scrim.setAttribute('aria-hidden', 'true');
if (kind === 'overlay') document.body.append(scrim);
document.body.append(popup);
const openButton = document.getElementById('open-letter');
const page = document.querySelector('.letter-page');
const email = document.getElementById('letter-email');
const success = document.getElementById('letter-success');
const isOpen = () => kind === 'dialog' ? popup.open : kind === 'popover' ? popup.matches(':popover-open') : !popup.hidden;
function open() {
  if (kind === 'dialog') { if (!popup.open) popup.showModal(); }
  else if (kind === 'popover') { if (!popup.matches(':popover-open')) popup.showPopover(); }
  else {
    popup.hidden = false;
    scrim.hidden = false;
    page.inert = true;
    document.getElementById('close-letter').focus();
  }
}
function close() {
  if (kind === 'dialog') popup.close();
  else if (kind === 'popover') popup.hidePopover();
  else { popup.hidden = true; scrim.hidden = true; page.inert = false; }
  openButton.focus();
}
openButton.addEventListener('click', open);
document.getElementById('close-letter').addEventListener('click', close);
scrim.addEventListener('click', close);
popup.addEventListener('keydown', event => {
  if (kind === 'overlay' && event.key === 'Escape') close();
  if (kind === 'overlay' && event.key === 'Tab') {
    const controls = [...popup.querySelectorAll('button,input')];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }
});
document.getElementById('letter-form').addEventListener('submit', event => {
  event.preventDefault();
  success.hidden = false;
});
window.ruyiDesignReviewState = {
  exportState: () => ({ open: isOpen(), email: email.value, subscribed: !success.hidden }),
  restoreState: state => {
    email.value = state.email || '';
    success.hidden = !state.subscribed;
    if (state.open) open(); else close();
  },
};
open();
