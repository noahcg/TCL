import Color from "colorjs.io";

const hue = document.querySelector("#hue");
const cards = document.querySelectorAll("[data-lightness]");
const status = document.querySelector("#palette-status");

function renderPalette() {
  for (const card of cards) {
    const color = new Color("oklch", [
      Number(card.dataset.lightness),
      0.09,
      Number(hue.value),
    ]);
    const hex = color.to("srgb").toString({ format: "hex" });

    card.querySelector(".swatch").style.setProperty("--swatch-color", hex);
    card.querySelector("code").textContent = hex;
  }

  status.textContent = `Palette ready at hue ${hue.value} degrees.`;
}

hue.disabled = false;
hue.addEventListener("input", renderPalette);
renderPalette();
