import { AnswerResponse } from '../shared/types';

export class AnswerCard {
  private el: HTMLElement;
  private titleEl: HTMLElement;
  private bodyEl: HTMLElement;
  private bulletsEl: HTMLElement;
  private footerEl: HTMLElement;
  private closeBtn: HTMLButtonElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'sc-answer-card sc-answer-card--hidden';

    this.titleEl = document.createElement('div');
    this.titleEl.className = 'sc-answer-card__title';

    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'sc-answer-card__body';

    this.bulletsEl = document.createElement('div');
    this.bulletsEl.className = 'sc-answer-card__bullets';

    const actions = document.createElement('div');
    actions.className = 'sc-answer-card__actions';

    this.closeBtn = document.createElement('button');
    this.closeBtn.className = 'sc-answer-card__button';
    this.closeBtn.textContent = 'Close';
    this.closeBtn.addEventListener('click', () => this.hide());

    actions.appendChild(this.closeBtn);

    this.footerEl = document.createElement('div');
    this.footerEl.className = 'sc-answer-card__footer';

    this.el.appendChild(this.titleEl);
    this.el.appendChild(this.bodyEl);
    this.el.appendChild(this.bulletsEl);
    this.el.appendChild(this.footerEl);
    this.el.appendChild(actions);
    document.body.appendChild(this.el);
  }

  show(response: AnswerResponse): void {
    this.titleEl.textContent = response.understanding;
    this.bodyEl.textContent = response.answer;

    this.bulletsEl.innerHTML = '';
    if (response.bullets.length > 0) {
      response.bullets.forEach((bullet) => {
        const item = document.createElement('div');
        item.className = 'sc-answer-card__bullet';
        item.textContent = `• ${bullet}`;
        this.bulletsEl.appendChild(item);
      });
      this.bulletsEl.style.display = 'flex';
    } else {
      this.bulletsEl.style.display = 'none';
    }

    this.footerEl.textContent = response.followUpQuestion
      ? `Follow-up: ${response.followUpQuestion}`
      : 'ShadowCursor answered without taking UI actions.';

    this.el.classList.remove('sc-answer-card--hidden');
  }

  hide(): void {
    this.el.classList.add('sc-answer-card--hidden');
  }
}
