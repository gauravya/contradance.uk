document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map').setView([54.5, -4], 6); // Center on the UK
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    function displayEvents(events) {
        const eventsContainer = document.getElementById('events');
        eventsContainer.innerHTML = ''; // Clear any existing events

        // Remove existing map markers
        map.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });

        const groupedEvents = groupEventsByName(events); // Group events by name

        groupedEvents.forEach(eventsAtName => {
            const eventElement = document.createElement('div');
            eventElement.className = 'event'; // Add event class for styling

            const firstEvent = eventsAtName[0]; // The first event in the grouped list
            const nextEvent = eventsAtName.find(event => new Date(event.date) >= new Date()); // Find the next upcoming event

            // Event details in HTML format
            eventElement.innerHTML = `
                <h2>${firstEvent.name}</h2>
                <p><strong>Location:</strong> ${firstEvent.city}, ${firstEvent.country}</p>
                <p><strong>Venue:</strong> ${firstEvent.venue}</p>
                <p><strong>Next Date:</strong> ${formatDate(nextEvent.date)}</p>
                <p><strong>Time:</strong> ${nextEvent.startTime} - ${nextEvent.endTime}</p>
                <p><a href="#" class="view-all-dates">View All Dates</a></p>
                <div class="all-dates" style="display: none;">
            `;

            // Add all recurring events to the "all-dates" div
            eventsAtName.forEach(event => {
                eventElement.querySelector('.all-dates').innerHTML += `
                    <p><strong>Date:</strong> ${formatDate(event.date)} | <strong>Time:</strong> ${event.startTime} - ${event.endTime}</p>
                `;
            });

            // Close the all-dates div and add a More Info link
            eventElement.querySelector('.all-dates').innerHTML += '</div>';
            eventElement.innerHTML += `<p><a href="${firstEvent.links ? firstEvent.links[0] : '#'}" target="_blank">More Info</a></p>`;

            // Append event to the container
            eventsContainer.appendChild(eventElement);

            // Create a popup content for the map marker
            const popupContent = `
                <strong>${firstEvent.name}</strong><br>
                ${formatDate(nextEvent.date)} ${nextEvent.startTime} - ${nextEvent.endTime}
            `;

            // Add marker to the map
            L.marker([firstEvent.latitude, firstEvent.longitude])
                .addTo(map)
                .bindPopup(popupContent);

            // Toggle all dates visibility
            eventElement.querySelector('.view-all-dates').addEventListener('click', (e) => {
                e.preventDefault();
                const allDatesDiv = eventElement.querySelector('.all-dates');
                if (allDatesDiv.style.display === 'none') {
                    allDatesDiv.style.display = 'block';
                    e.target.innerText = 'Hide Dates';
                } else {
                    allDatesDiv.style.display = 'none';
                    e.target.innerText = 'View All Dates';
                }
            });
        });
    }

    // Group events by their name (helps group recurring events)
    function groupEventsByName(events) {
        const grouped = {};
        events.forEach(event => {
            if (!grouped[event.name]) {
                grouped[event.name] = [];
            }
            grouped[event.name].push(event);
        });
        return Object.values(grouped);
    }

    // Format date into a readable format
    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-GB', options);
    }

    // Start with an empty events list
    document.getElementById('events').innerHTML = "<p>Please enter a city name to find events.</p>";

    // Function to handle nearby event search
    window.findNearbyEvents = function () {
        const cityInput = document.getElementById("city-input").value.trim();
        if (!cityInput) {
            alert("Please enter a city name.");
            return;
        }

        // Use OpenStreetMap's Nominatim API for geocoding
        const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityInput)},UK`;

        fetch(geocodeUrl)
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then((data) => {
                if (Array.isArray(data) && data.length > 0) {
                    const userLocation = {
                        latitude: parseFloat(data[0].lat),
                        longitude: parseFloat(data[0].lon),
                    };
                    displayNearbyEvents(userLocation, map); // Pass user location to display events
                } else {
                    alert("City not found. Please try again.");
                }
            })
            .catch((error) => {
                alert(`Error fetching location. ${error.message}`);
            });
    };

    // Display nearby events based on user location
    function displayNearbyEvents(userLocation, map) {
        const eventsContainer = document.getElementById("events");
        eventsContainer.innerHTML = ""; // Clear existing events

        const upcomingEvents = eventData.events
            .flatMap((event) => {
                if (event.recurringEvents) {
                    return event.recurringEvents.map((re) => ({
                        ...event,
                        ...re,
                    }));
                }
                return event;
            })
            .filter((event) => {
                const eventDate = new Date(event.date);
                return eventDate >= new Date(); // Only show future events
            });

        // Filter nearby events based on the distance
        let nearbyEvents = upcomingEvents.filter((event) => {
            const distance = getDistance(userLocation, {
                latitude: event.latitude,
                longitude: event.longitude,
            });
            return distance <= 50; // Show events within a 50 km radius
        });

        if (nearbyEvents.length === 0) {
            // Expand search radius if no nearby events are found
            nearbyEvents = upcomingEvents
                .sort((a, b) => {
                    const distanceA = getDistance(userLocation, {
                        latitude: a.latitude,
                        longitude: a.longitude,
                    });
                    const distanceB = getDistance(userLocation, {
                        latitude: b.latitude,
                        longitude: b.longitude,
                    });
                    return distanceA - distanceB; // Sort by nearest events
                })
                .slice(0, 3); // Show top 3 closest events
        }

        if (nearbyEvents.length === 0) {
            eventsContainer.innerHTML = "<p>No nearby events found.</p>";
            return;
        }

        displayEvents(nearbyEvents); // Display the filtered events

        // Recenter the map to the user's location
        map.setView([userLocation.latitude, userLocation.longitude], 10);
    }

    // Calculate the distance between two coordinates (Haversine formula)
    function getDistance(coord1, coord2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
        const dLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((coord1.latitude * Math.PI) / 180) *
            Math.cos((coord2.latitude * Math.PI) / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    }
});
