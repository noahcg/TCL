import { makePalette } from "@lounge/palette";

const hue = document.querySelector("#hue");
const cards = document.querySelectorAll(".swatch-card");
const status = document.querySelector("#palette-status");

function updatePalette() {
  const colors = makePalette(Number(hue.value));

  cards.forEach((card, index) => {
    card.querySelector(".swatch").style.setProperty("--swatch-color", colors[index]);
    card.querySelector("code").textContent = colors[index];
  });

  status.textContent = `Palette ready at hue ${hue.value} degrees.`;
}

updatePalette();
hue.disabled = false;
hue.addEventListener("input", updatePalette);
