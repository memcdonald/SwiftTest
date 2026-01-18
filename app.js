const wheelCanvas = document.getElementById("wheel");
const spinNowButton = document.getElementById("spinNow");
const locateButton = document.getElementById("locateMe");
const restaurantList = document.getElementById("restaurantList");
const resultName = document.getElementById("resultName");
const resultMeta = document.getElementById("resultMeta");
const profileForm = document.getElementById("profileForm");
const partnerForm = document.getElementById("partnerForm");
const partnerStatus = document.getElementById("partnerStatus");
const sampleProfileButton = document.getElementById("sampleProfile");
const fetchRestaurantsButton = document.getElementById("fetchRestaurants");
const restaurantStatus = document.getElementById("restaurantStatus");

let restaurantPool = [
  {
    name: "Pho & Flow",
    cuisine: "Vietnamese",
    tags: ["noodles", "gluten-free"],
    budget: "$$",
  },
  {
    name: "Green Harbor",
    cuisine: "Mediterranean",
    tags: ["vegan", "salads"],
    budget: "$$",
  },
  {
    name: "Sushi Static",
    cuisine: "Japanese",
    tags: ["sushi"],
    budget: "$$$",
  },
  {
    name: "Taco Tempo",
    cuisine: "Mexican",
    tags: ["tacos", "spicy"],
    budget: "$",
  },
  {
    name: "Harvest Table",
    cuisine: "American",
    tags: ["comfort", "vegetarian"],
    budget: "$$",
  },
  {
    name: "Curry Cloud",
    cuisine: "Indian",
    tags: ["curry", "vegan"],
    budget: "$$",
  },
];

let profile = JSON.parse(localStorage.getItem("spinbite-profile")) || {
  displayName: "",
  diet: "omnivore",
  budget: "$$",
  cuisines: "",
  timeWindow: "now",
  location: "",
  zipCode: "",
};
let partner = JSON.parse(localStorage.getItem("spinbite-partner")) || null;
let lastSpinner = localStorage.getItem("spinbite-last-spinner") || null;

const wheelState = {
  segments: restaurantPool.map((item) => item.name),
  angle: 0,
  spinning: false,
};
const pointerAngle = -Math.PI / 2;

function drawWheel() {
  const ctx = wheelCanvas.getContext("2d");
  const radius = wheelCanvas.width / 2;
  ctx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);
  const colors = ["#ede9fe", "#c7d2fe", "#fbcfe8", "#bbf7d0", "#fed7aa", "#bae6fd"];

  wheelState.segments.forEach((segment, index) => {
    const startAngle =
      pointerAngle + wheelState.angle + (index * 2 * Math.PI) / wheelState.segments.length;
    const endAngle = startAngle + (2 * Math.PI) / wheelState.segments.length;
    ctx.beginPath();
    ctx.moveTo(radius, radius);
    ctx.arc(radius, radius, radius - 10, startAngle, endAngle);
    ctx.fillStyle = colors[index % colors.length];
    ctx.fill();
    ctx.save();
    ctx.translate(radius, radius);
    ctx.rotate(startAngle + (endAngle - startAngle) / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 14px Inter";
    ctx.fillText(segment, radius - 25, 5);
    ctx.restore();
  });
}

function getSelectedIndex() {
  const segmentAngle = (2 * Math.PI) / wheelState.segments.length;
  const totalRotation = wheelState.angle % (2 * Math.PI);
  const adjusted = (2 * Math.PI + pointerAngle - totalRotation) % (2 * Math.PI);
  return Math.floor(adjusted / segmentAngle) % wheelState.segments.length;
}

function updateProfileForm() {
  Object.entries(profile).forEach(([key, value]) => {
    const field = profileForm.elements[key];
    if (field) {
      field.value = value;
    }
  });
}

function saveProfile() {
  localStorage.setItem("spinbite-profile", JSON.stringify(profile));
}

function updatePartnerStatus() {
  if (!partner) {
    partnerStatus.textContent = "No partner linked yet.";
    return;
  }
  const spinnerLine = lastSpinner
    ? `Last spin by ${lastSpinner}. Next spin: ${lastSpinner === profile.displayName ? partner.name : profile.displayName || "you"}.`
    : "No spins yet. Start the first spin!";
  partnerStatus.textContent = `${partner.name} linked (${partner.email}). ${spinnerLine}`;
}

function buildRestaurantList(restaurants) {
  restaurantList.innerHTML = "";
  restaurants.forEach((restaurant) => {
    const card = document.createElement("div");
    card.className = "restaurant-card";
    card.innerHTML = `
      <h4>${restaurant.name}</h4>
      <p class="restaurant-meta">${restaurant.cuisine} • ${restaurant.distance} mi • ${restaurant.available}</p>
      <p class="restaurant-meta">Budget ${restaurant.budget} • Match: ${restaurant.matchScore}%</p>
    `;
    restaurantList.appendChild(card);
  });
}

function scoreRestaurants() {
  const cuisines = profile.cuisines.toLowerCase().split(",").map((item) => item.trim());
  if (restaurantPool.length === 0) {
    restaurantStatus.textContent = "No restaurants loaded yet. Try another zip code.";
    return [];
  }
  restaurantStatus.textContent = `Showing ${restaurantPool.length} nearby restaurants.`;
  return restaurantPool.map((restaurant) => {
    const cuisineMatch = cuisines.some((cuisine) => cuisine && restaurant.cuisine.toLowerCase().includes(cuisine));
    const dietMatch = restaurant.tags.includes(profile.diet) || profile.diet === "omnivore";
    const budgetMatch = profile.budget === restaurant.budget;
    const matchScore =
      (cuisineMatch ? 40 : 0) +
      (dietMatch ? 35 : 0) +
      (budgetMatch ? 25 : 0) +
      Math.floor(Math.random() * 10);
    return {
      ...restaurant,
      matchScore,
      distance: (Math.random() * 3 + 0.4).toFixed(1),
      available: profile.timeWindow === "now" ? "Immediate seating" : `Ready in ${profile.timeWindow} min`,
    };
  });
}

function refreshRestaurants() {
  const restaurants = scoreRestaurants().sort((a, b) => b.matchScore - a.matchScore);
  wheelState.segments = restaurants.map((restaurant) => restaurant.name);
  buildRestaurantList(restaurants);
  drawWheel();
}

async function loadRestaurantsByZip() {
  const zipCode = profile.zipCode.trim();
  if (!zipCode) {
    restaurantStatus.textContent = "Enter a zip code to find nearby restaurants.";
    return;
  }
  restaurantStatus.textContent = "Looking up your area...";
  try {
    const geoResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&postalcode=${encodeURIComponent(zipCode)}&countrycodes=us&limit=1`,
      {
        headers: { "Accept-Language": "en" },
      }
    );
    if (!geoResponse.ok) {
      throw new Error("Unable to look up that zip code.");
    }
    const geoResults = await geoResponse.json();
    if (!geoResults.length) {
      throw new Error("No location found for that zip code.");
    }
    const { lat, lon, display_name: displayName } = geoResults[0];
    profile.location = displayName;
    profileForm.elements.location.value = displayName;
    saveProfile();
    restaurantStatus.textContent = "Fetching nearby restaurants...";

    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["amenity"="restaurant"](around:3000,${lat},${lon});
        way["amenity"="restaurant"](around:3000,${lat},${lon});
        relation["amenity"="restaurant"](around:3000,${lat},${lon});
      );
      out center 25;
    `;
    const overpassResponse = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: overpassQuery,
    });
    if (!overpassResponse.ok) {
      throw new Error("Restaurant lookup failed. Try again in a moment.");
    }
    const overpassData = await overpassResponse.json();
    restaurantPool = (overpassData.elements || [])
      .map((element) => {
        const name = element.tags?.name;
        if (!name) return null;
        const cuisine = element.tags?.cuisine
          ? element.tags.cuisine.split(";")[0].replaceAll("_", " ")
          : "Local";
        return {
          name,
          cuisine: cuisine.charAt(0).toUpperCase() + cuisine.slice(1),
          tags: element.tags?.diet?.split(";") ?? [],
          budget: "$$",
        };
      })
      .filter(Boolean)
      .slice(0, 12);

    if (restaurantPool.length === 0) {
      restaurantStatus.textContent = "No restaurants found nearby. Try another zip code.";
      refreshRestaurants();
      return;
    }
    refreshRestaurants();
  } catch (error) {
    restaurantStatus.textContent = error.message;
  }
}

function spinWheel() {
  if (wheelState.spinning) return;
  wheelState.spinning = true;
  const spinAngle = Math.random() * 10 + 15;
  const start = performance.now();
  const duration = 2400;

  function animate(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    wheelState.angle = spinAngle * easeOut;
    drawWheel();
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      wheelState.spinning = false;
      announceResult();
    }
  }
  requestAnimationFrame(animate);
}

function announceResult() {
  const selection = wheelState.segments[getSelectedIndex()];
  resultName.textContent = selection;
  const picked = restaurantPool.find((restaurant) => restaurant.name === selection);
  resultMeta.textContent = picked
    ? `${picked.cuisine} • Budget ${picked.budget}`
    : "Spin again for a better match.";

  if (profile.displayName) {
    lastSpinner = profile.displayName;
    localStorage.setItem("spinbite-last-spinner", lastSpinner);
  }
  updatePartnerStatus();
}

profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  profile = Object.fromEntries(new FormData(profileForm).entries());
  saveProfile();
  refreshRestaurants();
  updatePartnerStatus();
});

partnerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(partnerForm).entries());
  partner = { name: data.partnerName, email: data.partnerEmail };
  localStorage.setItem("spinbite-partner", JSON.stringify(partner));
  updatePartnerStatus();
  partnerForm.reset();
});

sampleProfileButton.addEventListener("click", () => {
  profile = {
    displayName: "Jamie",
    diet: "omnivore",
    budget: "$$",
    cuisines: "Sushi, Tacos, Mediterranean",
    timeWindow: "now",
    location: "Downtown",
    zipCode: "",
  };
  updateProfileForm();
  saveProfile();
  refreshRestaurants();
  updatePartnerStatus();
});

fetchRestaurantsButton.addEventListener("click", () => {
  profile = Object.fromEntries(new FormData(profileForm).entries());
  saveProfile();
  loadRestaurantsByZip();
});

locateButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    resultMeta.textContent = "Geolocation not supported in this browser.";
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      profile.location = `Lat ${position.coords.latitude.toFixed(2)}, Lng ${position.coords.longitude.toFixed(2)}`;
      profileForm.elements.location.value = profile.location;
      saveProfile();
    },
    () => {
      resultMeta.textContent = "Unable to access location. Please type it in.";
    }
  );
});

spinNowButton.addEventListener("click", () => {
  spinWheel();
});

drawWheel();
updateProfileForm();
if (profile.displayName) {
  refreshRestaurants();
}
updatePartnerStatus();
