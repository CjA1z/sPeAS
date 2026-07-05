import "./styles/globals.css";

const publicRoot = document.querySelector<HTMLElement>("[data-peas-public-root]");

if (publicRoot) {
  publicRoot.dataset.reactUiReady = "true";
}
