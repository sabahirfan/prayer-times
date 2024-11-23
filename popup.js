// popup.js
document.addEventListener('DOMContentLoaded', function() {
    const prayerNames = {
      fajr: 'Fajr',
      sunrise: 'Sunrise',
      dhuhr: 'Dhuhr',
      asr: 'Asr',
      maghrib: 'Maghrib',
      isha: 'Isha'
    };
  
    const methodSelect = document.getElementById('calculation-method');
    const timesContainer = document.getElementById('times-container');
    const locationPrompt = document.getElementById('location-prompt');
    const enableLocationBtn = document.getElementById('enable-location');
    const citySearchInput = document.getElementById('city-search');
    const searchCityBtn = document.getElementById('search-city');
    const searchResults = document.getElementById('search-results');
    const locationInfo = document.getElementById('location-info');
  
    // Load saved settings and initialize
    initialize();
  
    function initialize() {
      // Load saved settings
      chrome.storage.local.get(['calculationMethod', 'savedCity', 'savedLocation'], function(result) {
        if (result.calculationMethod) {
          methodSelect.value = result.calculationMethod;
        }
        if (result.savedCity) {
          citySearchInput.value = result.savedCity;
        }
        
        // Check if we have saved location
        if (result.savedLocation) {
          updatePrayerTimes(result.savedLocation.lat, result.savedLocation.lng);
          showLocationInfo(result.savedLocation);
        } else {
          // No saved location, start location check
          checkLocationAndUpdate();
        }
      });
  
      // Set up event listeners
      methodSelect.addEventListener('change', handleMethodChange);
      enableLocationBtn.addEventListener('click', requestGeolocation);
      searchCityBtn.addEventListener('click', searchCity);
      citySearchInput.addEventListener('keypress', handleSearchKeypress);
    }
  
    function handleMethodChange() {
      chrome.storage.local.set({ calculationMethod: this.value });
      chrome.storage.local.get(['savedLocation'], function(result) {
        if (result.savedLocation) {
          updatePrayerTimes(result.savedLocation.lat, result.savedLocation.lng);
        } else {
          checkLocationAndUpdate();
        }
      });
    }
  
    function handleSearchKeypress(e) {
      if (e.key === 'Enter') {
        searchCity();
      }
    }
  
    function checkLocationAndUpdate() {
      console.log('Checking location permissions...');
      navigator.permissions.query({ name: 'geolocation' })
        .then(function(permissionStatus) {
          console.log('Permission status:', permissionStatus.state);
          switch(permissionStatus.state) {
            case 'granted':
              requestGeolocation();
              break;
            case 'prompt':
              showLocationPrompt();
              break;
            case 'denied':
              console.log('Location permission denied');
              showLocationPrompt();
              break;
          }
  
          // Listen for changes in permission
          permissionStatus.addEventListener('change', function() {
            console.log('Permission status changed to:', this.state);
            if (this.state === 'granted') {
              requestGeolocation();
            }
          });
        })
        .catch(function(error) {
          console.error('Error checking permissions:', error);
          showLocationPrompt();
        });
    }
  
    function requestGeolocation() {
      console.log('Requesting geolocation...');
      timesContainer.innerHTML = '<div class="loading"><div class="spinner"></div>Getting location...</div>';
      
      const options = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      };
  
      navigator.geolocation.getCurrentPosition(
        // Success callback
        function(position) {
          console.log('Location obtained:', position);
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            name: 'Current Location'
          };
          
          chrome.storage.local.set({ savedLocation: location }, function() {
            console.log('Location saved');
            locationPrompt.style.display = 'none';
            updatePrayerTimes(location.lat, location.lng);
            showLocationInfo(location);
          });
        },
        // Error callback
        function(error) {
          console.error('Geolocation error:', error);
          let errorMessage = 'Unable to get location: ';
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += 'Location permission denied.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += 'Location information unavailable.';
              break;
            case error.TIMEOUT:
              errorMessage += 'Location request timed out.';
              break;
            default:
              errorMessage += 'Unknown error occurred.';
          }
          showLocationError(errorMessage);
        },
        // Options
        options
      );
    }
  
    function showLocationError(message) {
      console.error(message);
      showLocationPrompt();
      locationInfo.style.display = 'block';
      locationInfo.innerHTML = `<div class="error">${message}</div>`;
    }
  
    async function searchCity() {
      const city = citySearchInput.value.trim();
      if (!city) return;
  
      console.log('Searching for city:', city);
      searchCityBtn.disabled = true;
      searchResults.innerHTML = '<div class="loading"><div class="spinner"></div>Searching...</div>';
  
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=5`,
          {
            headers: {
              'Accept-Language': 'en-US,en;q=0.5',
              'User-Agent': 'PrayerTimesExtension/1.0'
            }
          }
        );
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        const data = await response.json();
        console.log('Search results:', data);
  
        if (data.length === 0) {
          searchResults.innerHTML = '<div class="error">No results found. Please try a different search.</div>';
          return;
        }
  
        displaySearchResults(data);
      } catch (error) {
        console.error('City search error:', error);
        searchResults.innerHTML = '<div class="error">Error searching for city. Please try again.</div>';
      } finally {
        searchCityBtn.disabled = false;
      }
    }
  
    function displaySearchResults(results) {
      searchResults.innerHTML = '';
      results.forEach(result => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.textContent = result.display_name;
        div.addEventListener('click', () => {
          const location = {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
            name: result.display_name
          };
          selectLocation(location);
        });
        searchResults.appendChild(div);
      });
    }
  
    function selectLocation(location) {
      console.log('Location selected:', location);
      chrome.storage.local.set({
        savedCity: citySearchInput.value,
        savedLocation: location
      });
      
      searchResults.innerHTML = '';
      locationPrompt.style.display = 'none';
      updatePrayerTimes(location.lat, location.lng);
      showLocationInfo(location);
    }
  
    function showLocationPrompt() {
      console.log('Showing location prompt');
      timesContainer.style.display = 'none';
      locationPrompt.style.display = 'block';
    }
  
    function showLocationInfo(location) {
      locationInfo.style.display = 'block';
      locationInfo.innerHTML = `
        <strong>Current Location:</strong><br>
        ${location.name || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}
      `;
    }
  
    function updatePrayerTimes(lat, lng) {
      console.log('Updating prayer times for:', lat, lng);
      try {
        // Set calculation method
        prayTimes.setMethod(methodSelect.value);
        
        // Function to get timezone offset for a location using its coordinates
    function getTimezoneOffset(lat, lng) {
        // Calculate approximate timezone based on longitude
        // Each 15 degrees of longitude represents roughly 1 hour time difference
        let timezoneOffset = Math.round(lng / 15);
        
        // Adjust for edge cases and common timezone boundaries
        // North America
        if (lng >= -141 && lng <= -52.5) {
            if (lng <= -127.5) return -8;  // Pacific Time (PT)
            if (lng <= -112.5) return -7;  // Mountain Time (MT)
            if (lng <= -97.5) return -6;   // Central Time (CT)
            if (lng <= -82.5) return -5;   // Eastern Time (ET)
            if (lng <= -67.5) return -4;   // Atlantic Time
            return -3.5;                   // Newfoundland Time
        }
        
        // Europe and Africa
        if (lng >= -30 && lng <= 40) {
            if (lng <= -7.5) return 0;     // GMT/UTC
            if (lng <= 7.5) return 1;      // Central European Time
            if (lng <= 22.5) return 2;     // Eastern European Time
            return 3;                      // Further East
        }
        
        // Asia
        if (lng > 40 && lng <= 180) {
            if (lng <= 52.5) return 3;     // Moscow Time
            if (lng <= 67.5) return 4;     // Further East
            if (lng <= 82.5) return 5;     // Further East
            if (lng <= 97.5) return 6;     // Further East
            if (lng <= 112.5) return 7;    // Further East
            if (lng <= 127.5) return 8;    // Further East
            if (lng <= 142.5) return 9;    // Japan
            return 10;                     // Further East
        }
        
        return timezoneOffset;  // Default to approximate calculation
    }
    
    // Get the timezone offset based on coordinates
    const timezoneOffset = getTimezoneOffset(lat, lng);
    
    // Get prayer times using the calculated timezone
    const times = prayTimes.getTimes(new Date(), [lat, lng], timezoneOffset);
       
        // Display times
        let html = '';
        for (const [key, name] of Object.entries(prayerNames)) {
          html += `
            <div class="prayer-time">
              <span class="prayer-name">${name}</span>
              <span class="prayer-time-value">${times[key]}</span>
            </div>
          `;
        }
        timesContainer.style.display = 'block';
        timesContainer.innerHTML = html;
      } catch (error) {
        console.error('Error updating prayer times:', error);
        timesContainer.innerHTML = '<div class="error">Error calculating prayer times. Please try again.</div>';
      }
    }
  });