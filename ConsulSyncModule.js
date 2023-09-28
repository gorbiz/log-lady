// ConsulSyncModule.js

// 
// Usage Example:
// 

// import ConsulSyncModule from './ConsulSyncModule';

// ConsulSyncModule.setAccountAndUrl("account1", "http://consul-server:8500");
// document.getElementById('text-input').addEventListener('keydown', function(event) {
//   if (event.key === "Enter") {
//     ConsulSyncModule.addNewEntry(timestamp, text);
//     ConsulSyncModule.syncWithConsul(); // Sync immediately after storing
//   }
// });

let ConsulSyncModule = (function() {
  let lastTimestamp = null;
  let accountPrefix = "default/";
  let consulUrl = "";

  // Function to fetch new entries from Consul
  async function fetchNewEntries() {
    if (!consulUrl) return [];
    
    let url = `${consulUrl}/v1/kv/${accountPrefix}?recurse`;
    if (lastTimestamp !== null) {
      url += `&keys&separator=/&near=${accountPrefix}${lastTimestamp}`;
    }
    
    const response = await fetch(url, { mode: 'no-cors' })
    console.log(response.ok, response.status)
    if (response.ok) {
      data = await response.json();
    } else if (response.status === 404) {
      return []
    } else {
      return []
      console.error('An error occurred:', response.status);
    }
    const data = await response.json();
    
    const newEntries = data.filter(entry => entry.Key > `${accountPrefix}${lastTimestamp}`);
    if (newEntries.length > 0) {
      lastTimestamp = newEntries[newEntries.length - 1].Key.split('/')[1];
    }
    
    return newEntries.map(entry => ({
      key: entry.Key.split('/')[1],
      value: atob(entry.Value)
    }));
  }

  // Public function to update the UI
  async function syncWithConsul() {
    const newEntries = await fetchNewEntries();
    if (newEntries.length > 0) {
      // Update your local storage and UI here, e.g., append new items to the list
      return newEntries
    }
  }

  // Public function to set account name and Consul URL
  function setAccountAndUrl(accountName, url) {
    accountPrefix = `${accountName}/`;
    consulUrl = url;
  }

  // Initialize sync with the Consul server every 30 seconds
  setInterval(syncWithConsul, 30000);

  // Function to add a new entry to Consul
  async function addNewEntry(key, value) {
    if (!consulUrl) return;
    
    const url = `${consulUrl}/v1/kv/${accountPrefix}${key}`;
    const base64Value = btoa(value);
    
    await fetch(url, {
      method: 'PUT',
      body: JSON.stringify({ Value: base64Value },
      { mode: 'no-cors' }
      )
    });
  }
  
  return {
    syncWithConsul,
    setAccountAndUrl,
    addNewEntry // Added this to the public API
  };
})();

export default ConsulSyncModule;
