import { combinedDictionaryData } from "./data/dictionaryData.js";

export function showDictionaryEntry(searchTerm) {
  const searchInput = document.getElementById("dictionarySearch");
  const contentDiv = document.getElementById("dictionaryContent");
  const term = (searchTerm || "").trim();

  if (!contentDiv) return;
  if (searchInput) {
    searchInput.value = term;
  }

  if (!term) {
    contentDiv.innerHTML = "<p>キーワードを入力してください</p>";
    return;
  }

  const matches = Object.entries(combinedDictionaryData)
    .filter(([key]) => key.includes(term));

  if (matches.length === 0) {
    contentDiv.innerHTML = "<p>該当する項目が見つかりません</p>";
    return;
  }

  contentDiv.innerHTML = matches.map(([key, data]) => `
    <div style="margin-bottom: 15px;">
      <h3 style="margin: 0 0 5px 0;">${key}</h3>
      <p style="margin: 0 0 5px 0;">${data.description}</p>
      <ul style="margin: 0; padding-left: 20px;">
        ${data.details
          .filter(detail => detail !== "ステータス補正: 直接補正なし")
          .map(detail => `<li>${detail}</li>`).join("")}
      </ul>
    </div>
  `).join("");
}

export function searchDictionary() {
  const searchTerm = document.getElementById("dictionarySearch").value.trim();
  showDictionaryEntry(searchTerm);
}

// Expose dictionary helpers for inline HTML handlers.
window.searchDictionary = searchDictionary;
window.showDictionaryEntry = showDictionaryEntry;
