document.addEventListener("DOMContentLoaded", () => {
    const map = L.map("map").setView([54.5, -4], 6); // Center on the UK
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
  
    // Function to display events on the page
    function displayEvents(events) {
      const eventsContainer = document.getElementById("events");
      eventsContainer.innerHTML = ""; // Clear existing events
  
      // Clear existing markers
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          map.removeLayer(layer);
        }
      });
  
      const uniqueEvents = new Map();
  
      // Loop through events and display them
      events.forEach((event) => {
        if (!uniqueEvents.has(event.name)) {
          const eventElement = document.createElement("div");
          eventElement.className = "event"; // Add styling class
  
          let eventDatesHTML = "";
  
          if (event.recurringEvents && event.recurringEvents.length > 0) {
            eventDatesHTML += `
              <details>
                <summary>Show Dates</summary>
                <div>
            `;
            event.recurringEvents.forEach((re) => {
              if (new Date(re.date) >= new Date()) {  // Show only future dates
                eventDatesHTML += `<p><strong>Date:</strong> ${formatDate(re.date)} | <strong>Time:</strong> ${re.startTime} - ${re.endTime}</p>`;
                if (re.bands) eventDatesHTML += `<p><strong>Band:</strong> ${re.bands.join(", ")}</p>`;
                if (re.callers) eventDatesHTML += `<p><strong>Caller:</strong> ${re.callers.join(", ")}</p>`;
              }
            });
            eventDatesHTML += `</div></details>`;
          } else if (event.start_date && new Date(event.start_date) >= new Date()) {
            eventDatesHTML += `<p><strong>Date:</strong> ${formatDate(event.start_date)} - ${formatDate(event.end_date)} | <strong>Time:</strong> Ongoing event</p>`;
            if (event.bands) eventDatesHTML += `<p><strong>Band:</strong> ${event.bands.join(", ")}</p>`;
            if (event.callers) eventDatesHTML += `<p><strong>Caller:</strong> ${event.callers.join(", ")}</p>`;
          } else if (event.date && new Date(event.date) >= new Date()) {
            eventDatesHTML += `<p><strong>Date:</strong> ${formatDate(event.date)} | <strong>Time:</strong> ${event.startTime} - ${event.endTime}</p>`;
            if (event.bands) eventDatesHTML += `<p><strong>Band:</strong> ${event.bands.join(", ")}</p>`;
            if (event.callers) eventDatesHTML += `<p><strong>Caller:</strong> ${event.callers.join(", ")}</p>`;
          }
  
          // Create event HTML
          eventElement.innerHTML = `
            <h2>${event.name}</h2>
            <p><strong>Location:</strong> ${event.city ? event.city + ", " + event.country : "Various Locations"}</p>
            <p><strong>Venue:</strong> ${event.venue ? event.venue : "Various Venues"}</p>
            ${eventDatesHTML}
            <p><a href="${event.links ? event.links[0] : "#"}" target="_blank">More Info</a></p>
          `;
  
          // Append event to the container
          eventsContainer.appendChild(eventElement);
  
          // Add a marker to the map
          const popupContent = `
            <strong>${event.name}</strong><br>
            ${event.venue}<br>
            ${eventDatesHTML}
          `;
          L.marker([event.latitude, event.longitude])
            .addTo(map)
            .bindPopup(popupContent);
  
          uniqueEvents.set(event.name, eventElement);
        }
      });
    }
  
    // Format the date into a readable format
    function formatDate(dateString) {
      const options = { year: "numeric", month: "long", day: "numeric" };
      return new Date(dateString).toLocaleDateString("en-GB", options);
    }
  
    // Function to handle search for nearby events based on city name or broader search terms
    window.findNearbyEvents = function () {
      const searchTerm = document.getElementById("city-input").value.trim().toLowerCase();
      if (!searchTerm) {
        alert("Please enter a search term.");
        return;
      }
  
      // Search for events by broader terms (city, venue, name)
      const matchingEvents = findEventsByTerm(searchTerm);
      if (matchingEvents.length > 0) {
        displayEvents(matchingEvents); // Show events if match found
        return;
      }
  
      // If no direct match, use geocoding to find nearby locations
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchTerm)},UK`;
  
      fetch(geocodeUrl)
        .then((response) => response.json())
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            const userLocation = {
              latitude: parseFloat(data[0].lat),
              longitude: parseFloat(data[0].lon),
            };
            displayNearbyEvents(userLocation); // Display nearby events based on location
          } else {
            alert("Location not found. Please try again.");
          }
        })
        .catch((error) => {
          alert(`Error fetching location: ${error.message}`);
        });
    };
  
    // Search for events by broader terms like city, venue, or event name
    function findEventsByTerm(term) {
      return eventData.events.filter((event) => {
        const cityMatch = event.city && event.city.toLowerCase().includes(term);
        const nameMatch = event.name.toLowerCase().includes(term);
        const venueMatch = event.venue && event.venue.toLowerCase().includes(term);
        const countryMatch = event.country && event.country.toLowerCase().includes(term);
        return cityMatch || nameMatch || venueMatch || countryMatch;
      });
    }
  
    // Function to display events near the user's location (after geocoding)
    function displayNearbyEvents(userLocation) {
      const upcomingEvents = eventData.events
        .flatMap((event) => {
          if (event.recurringEvents) {
            return event.recurringEvents.map((re) => ({
              ...event,
              ...re,
            }));
          }
          return [event]; // Non-recurring events
        })
        .filter((event) => new Date(event.date || event.start_date) >= new Date()); // Only future events
  
      const nearbyEvents = upcomingEvents.filter((event) => {
        const distance = getDistance(userLocation, {
          latitude: event.latitude,
          longitude: event.longitude,
        });
        return distance <= 100; // Within a 100 km radius
      });
  
      if (nearbyEvents.length === 0) {
        document.getElementById("events").innerHTML = "<p>No nearby events found.</p>";
      } else {
        displayEvents(nearbyEvents); // Display nearby events
        map.setView([userLocation.latitude, userLocation.longitude], 10); // Recenter map
      }
    }
  
    // Haversine formula to calculate distance between two lat/lon points
    function getDistance(coord1, coord2) {
      const R = 6371; // Radius of Earth in kilometers
      const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
      const dLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((coord1.latitude * Math.PI) / 180) * Math.cos((coord2.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c; // Distance in km
    }
  });
// Event data
const eventData = {
  events: [
    {
      name: "Contrabridge",
      city: "Cambridge",
      country: "UK",
      venue: "Stoneyard Centre",
      address: "43 St Andrew's St, Cambridge CB2 3AR",
      latitude: 52.20221,
      longitude: 0.12463,
      styles: ["contra"],
      recurringEvents: [
        {
          date: "2024-09-28",
          startTime: "19:30",
          endTime: "23:00",
          bands: ["Nozzy"],
          callers: ["Nicola Scott"],
        },
        {
          date: "2024-10-26",
          startTime: "19:30",
          endTime: "23:00",
          bands: ["King Kontra"],
          callers: ["Rob Humphrey"],
        },
        {
          date: "2024-11-30",
          startTime: "19:30",
          endTime: "23:00",
          bands: ["Fiddlechicks"],
          callers: ["Adam Hughes"],
        },
      ],
      links: ["https://contrabridge.org/"],
      organisation: "Contrabridge",
      accessibleVenue: true,
      calling: "Gender-Free",
      price:
        "£15 for supporters, £10 for standard and £7 for students or those who otherwise can't afford full price.",
      contact: "https://contrabridge.org/contact/",
    },
    {
      name: "Cambridge Contra",
      city: "Cambridge",
      country: "UK",
      venue: "St Andrew's Hall",
      address: "St Andrew's Road, Chesterton, CB4 1DH",
      latitude: 52.21295,
      longitude: 0.13707,
      styles: ["contra"],
      recurringEvents: [
        {
          date: "2024-09-06",
          startTime: "20:00",
          endTime: "22:15",
        },
        {
          date: "2024-09-20",
          startTime: "20:00",
          endTime: "22:15",
        },
        {
          date: "2024-10-04",
          startTime: "20:00",
          endTime: "22:15",
        },
        {
          date: "2024-10-18",
          startTime: "20:00",
          endTime: "22:15",
        },
        {
          date: "2024-11-01",
          startTime: "20:00",
          endTime: "22:15",
        },
        {
          date: "2024-11-15",
          startTime: "20:00",
          endTime: "22:15",
        },
        {
          date: "2024-11-29",
          startTime: "20:00",
          endTime: "22:15",
        },
        {
          date: "2024-12-13",
          startTime: "20:00",
          endTime: "22:15",
        },
      ],
      price: "£2 per evening",
      details: "We meet fortnightly on Friday evenings from 8 to 10:15 pm.",
    },
    {
      name: "Sheffield Scratch Contra",
      city: "Sheffield",
      country: "UK",
      venue: "Memorial Hall",
      address: "Forbes Rd, Hillsborough, Sheffield S6 2NW",
      latitude: 53.40129,
      longitude: -1.49974,
      styles: ["contra"],
      date: "2024-09-05",
      startTime: "19:30",
      endTime: "22:30",
      links: ["https://www.facebook.com/events/1050398396434069/"],
    },
    {
      name: "Edinburgh Contra Dance",
      city: "Edinburgh",
      country: "UK",
      venue: "Columcille Centre",
      address: "2 Newbattle Terrace, Edinburgh EH10 4RT",
      latitude: 55.93076,
      longitude: -3.20934,
      styles: ["contra"],
      date: "2024-09-07",
      startTime: "19:45",
      endTime: "23:00",
      bands: ["Sam Baxter and Heather McAslan"],
      callers: ["Rachel Shapiro Wallace"],
      price: "£10-£20; Under 12s go in for free!",
      links: [
        "https://www.citizenticket.com/events/edinburgh-contra-dance/edinburgh-contra-dance-september-7th/",
      ],
    },
    {
      name: "Bristol Contra",
      city: "Bristol",
      country: "UK",
      venue: "Faithspace, Redcliffe Methodist Church",
      address: "Faithspace, Redcliffe Methodist Church, Bristol, BS1 6PB",
      latitude: 51.4482,
      longitude: -2.59171,
      styles: ["contra"],
      recurringEvents: [
        {
          date: "2023-09-27",
          startTime: "19:15",
          endTime: "23:00",
          bands: ["Benjamin Rowe & Adam Rich-Griffin"],
          callers: ["Charlotte Rich-Griffin"],
        },
        {
          date: "2023-10-25",
          startTime: "19:15",
          endTime: "23:00",
          bands: ["Nozzy"],
          callers: ["Mark Elvins"],
        },
        {
          date: "2023-11-22",
          startTime: "19:15",
          endTime: "23:00",
          bands: ["Trip Hazard"],
          callers: ["Jack Kanutin"],
        },
        {
          date: "2024-01-24",
          startTime: "19:15",
          endTime: "23:00",
          bands: ["Chaotic Good"],
          callers: ["Daisy Black"],
        },
        {
          date: "2024-02-21",
          startTime: "19:15",
          endTime: "23:00",
          bands: ["Matt Norman and Edward Wallace"],
          callers: ["Bob Morgan"],
        },
        {
          date: "2024-03-28",
          startTime: "19:15",
          endTime: "23:00",
          bands: ["Contrary Faeries"],
          callers: ["Rob Humphrey"],
        },
        {
          date: "2024-04-25",
          startTime: "19:15",
          endTime: "23:00",
          bands: ["Dodging Pheasants"],
          callers: ["Lisa Heywood"],
        },
        {
          date: "2024-05-16",
          startTime: "19:15",
          endTime: "23:00",
          bands: ["Box of Frogs"],
          callers: ["Charlie Turner"],
        },
        {
          date: "2024-06-20",
          startTime: "19:15",
          endTime: "23:00",
          bands: ["Fiddlechicks"],
          callers: ["Louise Siddons"],
        },
      ],
      links: ["https://bristolcontra.wordpress.com/"],
      organisation: "Bristol Contra",
      price: "£6-£15",
    },
    {
      name: "AberACED",
      city: "Aberystwyth",
      country: "UK",
      venue: "Llanbadarn Fawr",
      address: "Llanbadarn Fawr, SY23 3QX, United Kingdom",
      latitude: 52.409776,
      longitude: -4.062045,
      styles: ["contra", "ecd"],
      date: "2024-09-07",
      startTime: "14:30",
      endTime: "16:30",
      workshop: true,
      social: true,
      price: "£3",
      organisation: "AberACED",
      links: ["https://aberaced.wordpress.com/"],
    },
    {
      name: "Englefield Green contra dance",
      city: "Egham",
      country: "UK",
      venue: "Jurgens Centre",
      address: "91 Harvest Rd., Englefield Green, Egham. TW20 0QR",
      latitude: 51.43158,
      longitude: -0.55239,
      styles: ["contra"],
      date: "2024-09-08",
      startTime: "14:30",
      endTime: "17:30",
      bands: ["Linda Game Band"],
      callers: ["Ivan Aitken"],
      organisation: "Ashford Folk Dancers",
      links: ["https://www.ashfordfolkdancers.org.uk/contra_dances/"],
    },
    {
      name: "Alcester Contra",
      links: ["https://davidfolk7.wixsite.com/alcestercontras"],
      date: "2024-09-13",
      startTime: "19:45",
      endTime: "22:45",
      country: "UK",
      city: "Alcester",
      venue: "Greig Hall",
      address: "Kinwarton Road, Alcester, Warwickshire, B49 6AD",
      latitude: 52.218171,
      longitude: -1.867962,
      styles: ["contra"],
      workshop: false,
      social: true,
      bands: ["Bearded Dragons"],
      callers: ["Louise Siddons"],
      price: "£4-£10",
      organisation: "Alcester Contra",
    },
    {
      name: "Solent Contra Dance",
      date: "2024-09-11",
      startTime: "20:00",
      endTime: "22:30",
      country: "UK",
      city: "Shawford",
      venue: "Parish hall",
      address: "Pearson Lane, Shawford. SO21 2AA",
      latitude: 51.023965,
      longitude: -1.329002,
      styles: ["contra"],
      workshop: false,
      social: true,
      price: "£5",
      organisation: "Solent Contra Dances",
      links: ["https://www.facebook.com/solentcontradances/"],
    },
    {
      name: "Harrogate Contra",
      links: [
        "http://harrogatecontra.org.uk/events.html",
        "https://www.facebook.com/events/1435301960414231/",
      ],
      date: "2024-09-14",
      startTime: "19:30",
      endTime: "22:30",
      country: "UK",
      city: "Harrogate",
      venue: "St Aelred's Church Hall",
      address: "Woodlands Drive, Harrogate, HG2 7BE",
      latitude: 53.992251,
      longitude: -1.502634,
      styles: ["contra"],
      workshop: false,
      social: true,
      bands: ["Philip & Benjamin"],
      callers: ["Charlie Turner"],
      price: "£6-£10",
      organisation: "Harrogate Contra",
    },
    {
      name: "London Barndance",
      city: "London",
      country: "UK",
      venue: "Cecil Sharp House",
      address: "Cecil Sharp House, London, NW1 7AY",
      latitude: 51.5381,
      longitude: -0.149363,
      styles: ["contra"],
      price: "£15 (£13 for LBC members and concessions, £5 for under-18s)",
      recurringEvents: [
        {
          date: "2024-09-14",
          startTime: "20:00",
          endTime: "23:00",
          bands: ["Linda Game Band"],
          callers: ["Adam Hughes"],
        },
        {
          date: "2024-10-12",
          startTime: "20:00",
          endTime: "23:00",
          bands: ["Old Time Contra Band"],
          callers: ["Diane Silver"],
        },
        {
          date: "2024-11-09",
          startTime: "20:00",
          endTime: "23:00",
          bands: ["Contrasaurus"],
          callers: ["Mark Elvins"],
        },
        {
          date: "2024-12-14",
          startTime: "20:00",
          endTime: "23:00",
          bands: ["King Contra String Band"],
          callers: ["Lynne Render"],
        },
      ],
      links: ["https://www.barndance.org/programme.html"],
      organisation: "London Barndance Company",
    },
    {
      name: "Nottingham Contra Dance",
      links: ["https://www.nfdg.org.uk/club_dances.php"],
      date: "2024-10-05",
      startTime: "19:30",
      endTime: "23:00",
      country: "UK",
      city: "Nottingham",
      venue: "Woodborough Village Hall",
      address: "Lingwood Lane, Woodborough, Nottingham, NG14 6DX",
      latitude: 53.021465,
      longitude: -1.060963,
      styles: ["contra"],
      workshop: false,
      social: true,
      bands: ["The Old Time Contra Band"],
      callers: ["Diane Silver"],
      price: "£10",
      organisation: "Nottingham Folk Dance Group",
    },
    {
      name: "Leeds Contra",
      city: "Leeds",
      country: "UK",
      venue: "St Chads Hall",
      address: "St Chads Hall, Otley Road, Leeds LS16 5JT",
      latitude: 53.82861,
      longitude: -1.584928,
      styles: ["contra"],
      date: "2024-09-28",
      startTime: "19:30",
      endTime: "23:00",
      bands: ["Joshua and Philip Rowe"],
      callers: ["Diane Silver (USA)"],
      price: "£10",
      organisation: "Leeds Contra",
      links: ["http://www.leedscontra.freeuk.com/specialevents.html"],
    },
    {
      name: "Lancaster Contra",
      details: "Musicians: Heather McAslan and Edward Wallace",
      links: [
        "http://lancastercontra.org.uk/events/",
        "https://www.facebook.com/events/710205900947385/",
      ],
      date: "2024-11-16",
      startTime: "13:30",
      endTime: "16:45",
      country: "UK",
      city: "Lancaster",
      venue: "St.Paul's Parish Hall, Scotforth Rd",
      latitude: 54.034323,
      longitude: -2.79528,
      styles: ["contra"],
      workshop: false,
      social: true,
      bands: ["Edward Wallace & Heather McAslan"],
      callers: ["Lisa Heywood"],
      price: "£10-£15",
      organisation: "Lancaster Contra",
    },
    {
      name: "Exeter Contra",
      city: "Exeter",
      country: "UK",
      venue: "Venue TBA",
      address: "Exeter, UK",
      latitude: 50.668809,
      longitude: -3.537793,
      styles: ["contra"],
      date: "2024-10-19",
      startTime: "19:30",
      endTime: "23:00",
      details: "Details TBD",
      links: ["https://barndancecaller.net/exetercontra.html"],
    },
    {
      name: "Bromyard Folk Festival",
      city: "Bromyard",
      country: "UK",
      venue: "Unnamed Road, Bromyard HR7 4NT",
      latitude: 52.19192,
      longitude: -2.50618,
      styles: ["contra", "e-ceilidh"],
      start_date: "2024-09-05",
      end_date: "2024-09-08",
      workshop: true,
      social: true,
      price: "Varies",
      links: [
        "https://bromyardfolkfestival.co.uk/",
        "https://www.facebook.com/events/1776143232854976/",
      ],
      organisation: "Bromyard Folk Festival",
      source: "events/uk/bromyard.yaml",
    },
    {
      name: "Autumn American Contra Dance Week",
      city: "Crowcombe, Taunton",
      country: "UK",
      venue: "Halsway Manor, Halsway Ln, Crowcombe, Taunton TA4 4BD",
      latitude: 51.13345,
      longitude: -3.24792,
      styles: ["contra"],
      start_date: "2024-09-30",
      end_date: "2024-10-04",
      workshop: true,
      social: true,
      price: "£240-£430",
      bands: ["Will Allen", "Rowan Pigott", "Gareth Kiddier"],
      callers: ["Diane Silver"],
      links: [
        "https://halswaymanor.org.uk/event/autumn-american-contra-dance-week2024/",
      ],
      organisation: "Halsway Manor",
      source: "events/uk/halsway.yaml",
    },
    {
      name: "Electric Folk Dance Party",
      city: "Hope, Hope Valley",
      country: "UK",
      venue: "Market Place, Hope, Hope Valley S33 6RH",
      latitude: 53.347546,
      longitude: -1.741412,
      styles: ["balfolk", "contra", "e-ceilidh"],
      start_date: "2024-10-19",
      end_date: "2024-10-20",
      workshop: false,
      social: true,
      price: "Varies",
      bands: ["Bearded Dragons", "Apolkalypse", "Portmanteau"],
      callers: ["Charlie Turner", "Lisa Heywood"],
      links: [
        "https://electricfolkdance.party/",
        "https://www.facebook.com/events/1418515775389104/",
      ],
      organisation: "Electric Folk Dance Party",
      source: "events/uk/hope.yaml",
    },

    {
      name: "Sytchampton Saturday Dance",
      city: "Sytchampton, Stourport-on-Severn",
      country: "UK",
      venue: "The Bungalow, Cow Ln, Sytchampton, Stourport-on-Severn DY13 9SY",
      latitude: 52.292101,
      longitude: -2.227237,
      styles: ["ecd", "contra"],
      start_date: "2024-09-28",
      end_date: "2024-09-28",
      workshop: false,
      social: true,
      price: "£8",
      bands: ["Chris & Julie Dewhurst"],
      callers: ["Mike Courthold"],
      links: [
        "https://www.sytchamptondanceclub.org.uk/p/dance-diary-experiment.html",
      ],
      organisation: "Sytchampton Folk Dance Club",
      source: "events/uk/sytchampton.yaml",
    },

    {
      name: "Zesty Contra Weekend",
      city: "Crowcombe, Taunton",
      country: "UK",
      venue: "Halsway Manor, Halsway Ln, Crowcombe, Taunton TA4 4BD",
      latitude: 51.13345,
      longitude: -3.24792,
      styles: ["contra"],
      start_date: "2024-11-15",
      end_date: "2024-11-17",
      workshop: true,
      social: true,
      price: "£190-£310",
      bands: ["Ali & Mollie"],
      callers: ["Rhodri Davies", "Mark Elvins"],
      links: ["https://halswaymanor.org.uk/event/zesty-contra-2024/"],
      organisation: "Halsway Manor",
      source: "events/uk/halsway.yaml",
    },
  ],
};
