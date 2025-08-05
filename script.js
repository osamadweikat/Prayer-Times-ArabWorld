document.addEventListener("DOMContentLoaded", () => {
  const axiosScript = document.createElement("script");
  axiosScript.src = "https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js";
  document.head.appendChild(axiosScript);

  axiosScript.onload = () => {
    const searchInput = document.getElementById("locationSearch");
    const suggestionsList = document.createElement("div");
    suggestionsList.className = "suggestions-list";
    searchInput.insertAdjacentElement("afterend", suggestionsList);

    const dateInput = document.getElementById("dateInput");
    const prayerCards = document.getElementById("prayerCards");
    const dateSection = dateInput.parentElement;

    const countries = Object.keys(arabicLocations);

    let selectedCountry = null;
    let selectedCity = null;

    function formatTo12Hour(time) {
      let [hour, minute] = time.split(":").map(Number);
      const period = hour < 12 ? "ص" : "م";
      hour = hour % 12 || 12;
      return `${hour}:${minute.toString().padStart(2, "0")} ${period}`;
    }

    function normalize(text) {
      return text
        .toLowerCase()
        .replace(/[أإآا]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ة/g, "ه")
        .trim();
    }

    function levenshtein(a, b) {
      const m = [];
      for (let i = 0; i <= b.length; i++) m[i] = [i];
      for (let j = 0; j <= a.length; j++) m[0][j] = j;

      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          m[i][j] =
            b[i - 1] === a[j - 1]
              ? m[i - 1][j - 1]
              : 1 + Math.min(m[i - 1][j - 1], m[i][j - 1], m[i - 1][j]);
        }
      }
      return m[b.length][a.length];
    }

    function filterSuggestions(input) {
      const val = normalize(input);
      suggestionsList.innerHTML = "";
      if (val.length === 0) return;

      const words = val.split(" ");
      const suggestions = [];

      Object.entries(arabicLocations).forEach(([country, cities]) => {
        const normCountry = normalize(country);

        cities.forEach((city) => {
          const normCity = normalize(city);
          const fullEntry = `${normCountry} ${normCity}`;

          const matchesAll = words.every((word) => {
            const inCountry =
              normCountry.includes(word) || levenshtein(normCountry, word) <= 2;
            const inCity =
              normCity.includes(word) || levenshtein(normCity, word) <= 2;
            return inCountry || inCity;
          });

          if (matchesAll) {
            suggestions.push({
              text: `${country} - ${city}`,
              type: "city",
              country,
              city,
            });
          }
        });
      });

      if (suggestions.length === 0) {
        const noResult = document.createElement("div");
        noResult.textContent = "لم يتم العثور على نتائج";
        suggestionsList.appendChild(noResult);
      }

      suggestions.forEach((item) => {
        const div = document.createElement("div");
        div.textContent = item.text;
        div.dataset.type = item.type;
        div.dataset.country = item.country;
        div.dataset.city = item.city;
        suggestionsList.appendChild(div);
      });
    }

    suggestionsList.addEventListener("click", async (e) => {
      if (e.target && e.target.dataset.type === "city") {
        selectedCountry = e.target.dataset.country;
        selectedCity = e.target.dataset.city;

        searchInput.value = `${selectedCountry} - ${selectedCity}`;
        suggestionsList.innerHTML = "";

        const today = new Date().toISOString().split("T")[0];
        dateInput.value = today;

        dateSection.style.display = "block";
        await fetchPrayerTimes(selectedCountry, selectedCity, today);
      }
    });

    searchInput.addEventListener("input", (e) => {
      filterSuggestions(e.target.value);
    });

    dateInput.addEventListener("change", () => {
      if (selectedCountry && selectedCity) {
        fetchPrayerTimes(selectedCountry, selectedCity, dateInput.value);
      }
    });

    async function fetchPrayerTimes(countryAr, cityAr, date) {
      if (!countryAr || !cityAr) return;

      const countryEn = countryMap[countryAr] || countryAr;
      const cityEn = cityMap[cityAr] || cityAr;

      const selectedDate = date ? new Date(date) : new Date();
      const formattedDate = selectedDate.toISOString().split("T")[0];
      const [year, month, day] = formattedDate.split("-");

      try {
        const res = await axios.get(
          `https://api.aladhan.com/v1/timingsByCity/${day}-${month}-${year}`,
          {
            params: {
              city: cityEn,
              country: countryEn,
              method: 3,
              school: 2,
            },
          }
        );

        if (res.data && res.data.data) {
          displayPrayerTimes(res.data.data.timings);
        }
      } catch (error) {
        console.error("خطأ في جلب مواقيت الصلاة:", error);
      }
    }

    function displayPrayerTimes(timings) {
      if (!prayerCards) return;

      const prayers = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
      const prayerNames = {
        Fajr: "الفجر",
        Sunrise: "الشروق",
        Dhuhr: "الظهر",
        Asr: "العصر",
        Maghrib: "المغرب",
        Isha: "العشاء",
      };

      prayerCards.innerHTML = "";

      prayers.forEach((prayer) => {
        const card = document.createElement("div");
        card.className = "card";

        const title = document.createElement("h2");
        title.textContent = prayerNames[prayer];

        const time = document.createElement("p");
        time.textContent = formatTo12Hour(timings[prayer]);

        card.appendChild(title);
        card.appendChild(time);
        prayerCards.appendChild(card);
      });

      prayerCards.style.display = "flex";
    }
  };
});
