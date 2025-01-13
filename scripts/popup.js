document.getElementById("open-sidebar").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0].id;
    chrome.scripting.executeScript({
      target: { tabId },
      func: openSidebar,
    });
  });
});

function openSidebar() {
  let sidebar = document.getElementById("deployment-sidebar");
  if (!sidebar) {
    sidebar = createSidebar();
    document.body.appendChild(sidebar);
  } else {
    sidebar.style.display = sidebar.style.display === "none" ? "block" : "none";
  }
}

function createSidebar() {
  const sidebar = document.createElement("div");
  sidebar.id = "deployment-sidebar";
  sidebar.style = `
    position: fixed;
    top: 0;
    right: 0;
    width: 300px;
    height: 100%;
    background-color: #f4f4f4;
    z-index: 9999;
    padding: 10px;
    overflow-y: auto;
  `;

  const closeButton = document.createElement("button");
  closeButton.innerText = "Close Sidebar";
  closeButton.style = "position: absolute; top: 10px; left: 10px;";
  closeButton.addEventListener("click", () => sidebar.remove());
  sidebar.appendChild(closeButton);

  const instructionsContainer = document.createElement("div");
  instructionsContainer.id = "instructions-container";
  instructionsContainer.style = "margin-top: 50px;";
  sidebar.appendChild(instructionsContainer);

  // Add loading placeholder
  instructionsContainer.innerHTML = "<p>Loading instructions...</p>";

  return sidebar;
}
