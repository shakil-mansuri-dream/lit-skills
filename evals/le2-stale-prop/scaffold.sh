#!/usr/bin/env bash
# A small lit-element 2 + Redux app, the shape that trips agents up: the old Lit is only visible
# in package.json and the shared base class.
set -euo pipefail
mkdir -p src/components src/redux

cat > package.json <<'JSON'
{ "name": "board-app", "version": "1.0.0", "type": "module",
  "dependencies": { "lit-element": "^2.5.1", "lit-html": "^1.4.1", "pwa-helpers": "^0.9.1", "redux": "^4.2.1", "reselect": "^5.1.0" } }
JSON

cat > src/components/base-element.js <<'JS'
import { LitElement } from 'lit-element';
export class BaseElement extends LitElement {}
JS

cat > src/components/price-tag.js <<'JS'
import { html } from 'lit-element';
import { BaseElement } from './base-element.js';

class PriceTag extends BaseElement {
  static get properties() {
    return { cents: { type: Number }, currency: { type: String } };
  }
  render() {
    return html`<span class="price">${this.cents}</span>`;
  }
}
customElements.define('price-tag', PriceTag);
JS

cat > src/redux/store.js <<'JS'
import { createStore } from 'redux';
export const store = createStore((s = { cards: {}, selectedId: null }) => s);
JS

cat > src/redux/selectors.js <<'JS'
import { createSelector } from 'reselect';
export const selectCards = (state) => state.cards;
export const selectCard = (state, id) => state.cards[id];
export const selectCardTitle = createSelector([selectCard], (card) => (card ? card.title : ''));
JS

cat > src/components/card-view.js <<'JS'
import { html } from 'lit-element';
import { connect } from 'pwa-helpers/connect-mixin.js';
import { BaseElement } from './base-element.js';
import { store } from '../redux/store.js';
import { selectCardTitle } from '../redux/selectors.js';

class CardView extends connect(store)(BaseElement) {
  static get properties() {
    return { cardId: { type: String }, _title: { type: String } };
  }
  stateChanged(state) {
    this._title = selectCardTitle(state, this.cardId);
  }
  render() {
    return html`<h2>${this._title}</h2>`;
  }
}
customElements.define('card-view', CardView);
JS
