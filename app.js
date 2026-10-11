// ======================================================
// LIFE PILOT AI
// Main JavaScript
// ======================================================


// ======================================================
// WEATHER
// ======================================================

let currentWeather = null;

async function detectLocation() {

    if (!navigator.geolocation) {

        alert("Your browser does not support location detection.");

        return;
    }

    const button = event?.target;

    if (button) {
        button.disabled = true;
        button.innerText = "📍 Detecting...";
    }

    navigator.geolocation.getCurrentPosition(

        async function (position) {

            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            try {

                const response = await fetch(
                    `/api/weather?lat=${latitude}&lon=${longitude}`
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Weather request failed");
                }

                currentWeather = data;

                updateWeather(data);

            } catch (error) {

                console.error(error);

                alert(
                    "Unable to get weather information.\n" +
                    error.message
                );

            } finally {

                if (button) {

                    button.disabled = false;

                    button.innerText =
                        "📍 Detect My Location";
                }
            }
        },

        function (error) {

            console.error(error);

            alert(
                "Location permission was denied or unavailable.\n\n" +
                "Please allow location access in your browser."
            );

            if (button) {

                button.disabled = false;

                button.innerText =
                    "📍 Detect My Location";
            }
        },

        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
        }
    );
}


function updateWeather(data) {

    const current = data.current || {};

    document.getElementById("locationName").innerText =
        data.location || "Unknown location";

    document.getElementById("temperature").innerText =
        `${round(current.temperature)}°C`;

    document.getElementById("feelsLike").innerText =
        `${round(current.apparent_temperature)}°C`;

    document.getElementById("humidity").innerText =
        `${round(current.relative_humidity)}%`;

    document.getElementById("rainfall").innerText =
        `${round(current.rain)} mm`;

    document.getElementById("wind").innerText =
        `${round(current.wind_speed)} km/h`;

    document.getElementById("weatherIcon").innerText =
        weatherEmoji(current.weather_code);

    const rainChance =
        data.daily?.precipitation_probability_max?.[0];

    if (rainChance !== undefined && rainChance !== null) {

        document.getElementById("weatherMessage").innerText =
            `Rain probability today: ${rainChance}%`;

    } else {

        document.getElementById("weatherMessage").innerText =
            "Current weather information updated.";
    }

    updateForecast(data);
}


function updateForecast(data) {

    const container =
        document.getElementById("forecast");

    container.innerHTML = "";

    const daily = data.daily;

    if (!daily || !daily.time) {

        container.innerHTML =
            `<p class="empty-message">
                Forecast unavailable.
            </p>`;

        return;
    }

    for (let i = 0; i < daily.time.length; i++) {

        const date = new Date(
            daily.time[i] + "T00:00:00"
        );

        const dayName = date.toLocaleDateString(
            "en-US",
            {
                weekday: "short"
            }
        );

        const maxTemp =
            daily.temperature_2m_max?.[i];

        const minTemp =
            daily.temperature_2m_min?.[i];

        const rainChance =
            daily.precipitation_probability_max?.[i];

        const code =
            daily.weather_code?.[i];

        const card =
            document.createElement("div");

        card.className = "forecast-card";

        card.innerHTML = `

            <div class="day">
                ${dayName}
            </div>

            <div class="icon">
                ${weatherEmoji(code)}
            </div>

            <div class="temp">
                ${round(maxTemp)}° /
                ${round(minTemp)}°
            </div>

            <small>
                🌧️ ${rainChance ?? "--"}%
            </small>
        `;

        container.appendChild(card);
    }
}


function weatherEmoji(code) {

    if (code === undefined || code === null) {
        return "🌤️";
    }

    if (code === 0) {
        return "☀️";
    }

    if (code <= 3) {
        return "🌤️";
    }

    if (code <= 48) {
        return "🌫️";
    }

    if (code <= 67) {
        return "🌧️";
    }

    if (code <= 77) {
        return "❄️";
    }

    if (code <= 82) {
        return "🌦️";
    }

    if (code <= 99) {
        return "⛈️";
    }

    return "🌤️";
}


function round(value) {

    if (value === undefined || value === null) {
        return "--";
    }

    return Math.round(value);
}


// ======================================================
// AI PLANNER
// ======================================================

async function generatePlan() {

    const tasks =
        document.getElementById("tasks").value.trim();

    if (!tasks) {

        alert(
            "Please enter the tasks you need to complete today."
        );

        return;
    }

    const wakeTime =
        document.getElementById("wakeTime").value;

    const sleepTime =
        document.getElementById("sleepTime").value;

    const sleepHours =
        document.getElementById("sleepHours").value;

    const mealPreference =
        document.getElementById("mealPreference").value;

    const meetings =
        document.getElementById("meetings").value.trim();


    const button =
        document.querySelector(
            ".planner-card .primary-btn"
        );

    button.disabled = true;

    button.innerText =
        "🧠 Creating your schedule...";


    const planOutput =
        document.getElementById("planOutput");

    const planResult =
        document.getElementById("planResult");


    planResult.classList.remove("hidden");

    planOutput.innerText =
        "Gemini is designing a realistic schedule for you...";


    try {

        const response = await fetch(
            "/api/plan",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    tasks: tasks,

                    wake_time: wakeTime,

                    sleep_time: sleepTime,

                    sleep_hours: sleepHours,

                    meal_preference: mealPreference,

                    meetings: meetings,

                    weather: currentWeather

                })
            }
        );


        const data = await response.json();


        if (!response.ok) {

            throw new Error(
                data.error || "Could not generate schedule."
            );
        }


        planOutput.innerText =
            data.plan || "No schedule generated.";


        planResult.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });


    } catch (error) {

        console.error(error);

        planOutput.innerText =
            "Error: " + error.message;

    } finally {

        button.disabled = false;

        button.innerText =
            "✨ Create My AI Schedule";
    }
}


// ======================================================
// OUTFIT AI
// ======================================================

let selectedImages = [];


function previewImages() {

    const input =
        document.getElementById("outfitImages");

    const preview =
        document.getElementById("imagePreview");


    selectedImages =
        Array.from(input.files).slice(0, 4);


    preview.innerHTML = "";


    if (input.files.length > 4) {

        alert(
            "Please select a maximum of 4 outfit images."
        );
    }


    selectedImages.forEach(
        function (file) {

            const reader =
                new FileReader();


            reader.onload =
                function (e) {

                    const img =
                        document.createElement("img");

                    img.src =
                        e.target.result;

                    preview.appendChild(img);
                };


            reader.readAsDataURL(file);
        }
    );
}


async function analyzeOutfit() {

    if (selectedImages.length === 0) {

        alert(
            "Please upload at least one outfit photo."
        );

        return;
    }


    const mood =
        document.getElementById("mood").value;

    const occasion =
        document.getElementById("occasion").value;

    const stylePreference =
        document.getElementById("stylePreference").value;


    const button =
        document.querySelector(
            ".style-card .primary-btn"
        );


    button.disabled = true;

    button.innerText =
        "✨ AI is analyzing outfits...";


    const result =
        document.getElementById("outfitResult");

    const output =
        document.getElementById("outfitOutput");


    result.classList.remove("hidden");

    output.innerText =
        "Gemini is comparing your outfits...";


    const formData =
        new FormData();


    formData.append(
        "mood",
        mood
    );

    formData.append(
        "occasion",
        occasion
    );

    formData.append(
        "style_preference",
        stylePreference
    );


    selectedImages.forEach(
        function (file) {

            formData.append(
                "images",
                file
            );
        }
    );


    try {

        const response =
            await fetch(
                "/api/outfit",
                {
                    method: "POST",
                    body: formData
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not analyze outfits."
            );
        }


        output.innerText =
            data.recommendation ||
            "No recommendation generated.";


        result.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });


    } catch (error) {

        console.error(error);

        output.innerText =
            "Error: " + error.message;

    } finally {

        button.disabled = false;

        button.innerText =
            "👗 Ask AI to Choose";
    }
}


// ======================================================
// REACTION GAME
// ======================================================

let reactionStartTime = 0;
let reactionTimeout = null;


function startReactionGame() {

    const area =
        document.getElementById("reactionArea");


    area.innerText =
        "Wait for GREEN...";


    area.style.background =
        "rgba(255, 160, 0, 0.15)";


    const delay =
        Math.floor(
            Math.random() * 3000
        ) + 1500;


    reactionTimeout =
        setTimeout(
            function () {

                reactionStartTime =
                    Date.now();


                area.innerText =
                    "🟢 CLICK NOW!";


                area.style.background =
                    "rgba(0, 220, 130, 0.2)";


                area.onclick =
                    function () {

                        const reaction =
                            Date.now() -
                            reactionStartTime;


                        area.innerText =
                            `⚡ Your reaction: ${reaction} ms`;


                        area.style.background =
                            "rgba(100, 100, 255, 0.2)";


                        area.onclick = null;
                    };

            },
            delay
        );
}


// ======================================================
// MEMORY GAME
// ======================================================

function startMemoryGame() {

    const area =
        document.getElementById("memoryArea");


    const numbers = [];

    for (let i = 0; i < 6; i++) {

        numbers.push(
            Math.floor(
                Math.random() * 10
            )
        );
    }


    area.innerText =
        numbers.join(" ");


    setTimeout(
        function () {

            area.innerText =
                "What were the numbers?";


            const answer =
                prompt(
                    "Enter the 6 numbers separated by spaces:"
                );


            if (!answer) {

                area.innerText =
                    "Game cancelled.";

                return;
            }


            const userNumbers =
                answer.trim().split(/\s+/);


            if (
                userNumbers.join(" ") ===
                numbers.join(" ")
            ) {

                area.innerText =
                    "🎉 Perfect memory!";

            } else {

                area.innerText =
                    `❌ Correct sequence: ${numbers.join(" ")}`;
            }

        },
        3000
    );
}


// ======================================================
// NUMBER HUNT
// ======================================================

function startNumberGame() {

    const area =
        document.getElementById("numberArea");


    const target =
        Math.floor(
            Math.random() * 10
        ) + 1;


    area.innerText =
        "Find a number from 1 to 10...";


    const answer =
        prompt(
            "Guess the number between 1 and 10:"
        );


    if (!answer) {

        area.innerText =
            "Game cancelled.";

        return;
    }


    const guess =
        parseInt(answer);


    if (guess === target) {

        area.innerText =
            "🎉 Correct! You found it.";

    } else {

        area.innerText =
            `❌ Wrong! The number was ${target}.`;
    }
}


// ======================================================
// ROCK PAPER SCISSORS
// ======================================================

function playRPS(player) {

    const choices = [
        "rock",
        "paper",
        "scissors"
    ];


    const computer =
        choices[
        Math.floor(
            Math.random() *
            choices.length
        )
        ];


    let result;


    if (player === computer) {

        result = "🤝 Draw!";

    } else if (

        (player === "rock" &&
            computer === "scissors") ||

        (player === "paper" &&
            computer === "rock") ||

        (player === "scissors" &&
            computer === "paper")

    ) {

        result = "🎉 You win!";

    } else {

        result = "😈 Computer wins!";
    }


    document.getElementById("rpsResult").innerText =
        `You: ${player} | Computer: ${computer} → ${result}`;
}


// ======================================================
// QUIZ DATA
// ======================================================

const quizQuestions = {

    1: [

        {
            question: "What is the capital of India?",
            options: [
                "Mumbai",
                "New Delhi",
                "Kolkata",
                "Chennai"
            ],
            answer: 1
        },

        {
            question: "How many days are there in a leap year?",
            options: [
                "365",
                "366",
                "364",
                "360"
            ],
            answer: 1
        },

        {
            question: "Which planet is known as the Red Planet?",
            options: [
                "Earth",
                "Mars",
                "Jupiter",
                "Venus"
            ],
            answer: 1
        },

        {
            question: "How many continents are there?",
            options: [
                "5",
                "6",
                "7",
                "8"
            ],
            answer: 2
        },

        {
            question: "Which ocean is the largest?",
            options: [
                "Atlantic",
                "Indian",
                "Pacific",
                "Arctic"
            ],
            answer: 2
        }

    ],


    2: [

        {
            question: "Who developed the theory of relativity?",
            options: [
                "Newton",
                "Albert Einstein",
                "Tesla",
                "Galileo"
            ],
            answer: 1
        },

        {
            question: "What is the chemical symbol for gold?",
            options: [
                "Ag",
                "Au",
                "Fe",
                "Gd"
            ],
            answer: 1
        },

        {
            question: "Which is the largest planet?",
            options: [
                "Earth",
                "Saturn",
                "Jupiter",
                "Neptune"
            ],
            answer: 2
        },

        {
            question: "Which language is primarily used for web styling?",
            options: [
                "HTML",
                "CSS",
                "Python",
                "C++"
            ],
            answer: 1
        },

        {
            question: "What is the square root of 144?",
            options: [
                "10",
                "11",
                "12",
                "14"
            ],
            answer: 2
        }

    ],


    3: [

        {
            question: "Which protocol is used for secure web browsing?",
            options: [
                "HTTP",
                "FTP",
                "HTTPS",
                "SMTP"
            ],
            answer: 2
        },

        {
            question: "Which data structure follows LIFO?",
            options: [
                "Queue",
                "Stack",
                "Array",
                "Tree"
            ],
            answer: 1
        },

        {
            question: "What does CPU stand for?",
            options: [
                "Central Processing Unit",
                "Computer Personal Unit",
                "Central Program Utility",
                "Computer Processing Utility"
            ],
            answer: 0
        },

        {
            question: "Which sorting algorithm has average O(n log n) complexity?",
            options: [
                "Bubble Sort",
                "Selection Sort",
                "Merge Sort",
                "Linear Search"
            ],
            answer: 2
        },

        {
            question: "Which number system uses base 16?",
            options: [
                "Binary",
                "Decimal",
                "Octal",
                "Hexadecimal"
            ],
            answer: 3
        }

    ]

};


let currentQuizLevel = 1;
let currentQuestion = 0;
let quizScore = 0;
let shuffledQuestions = [];


function startQuiz(level) {

    currentQuizLevel = level;

    currentQuestion = 0;

    quizScore = 0;


    shuffledQuestions =
        [...quizQuestions[level]]
            .sort(
                () => Math.random() - 0.5
            );


    showQuizQuestion();
}


function showQuizQuestion() {

    const area =
        document.getElementById("quizArea");


    if (
        currentQuestion >=
        shuffledQuestions.length
    ) {

        area.innerHTML = `

            <h3>🎉 Quiz Completed!</h3>

            <p class="quiz-score">
                Score:
                ${quizScore}/${shuffledQuestions.length}
            </p>

            <button
                class="primary-btn"
                onclick="startQuiz(${currentQuizLevel})"
            >
                🔄 Play Again
            </button>
        `;

        return;
    }


    const q =
        shuffledQuestions[currentQuestion];


    let html = `

        <div class="quiz-score">
            Level ${currentQuizLevel}
            &nbsp; | &nbsp;
            Score: ${quizScore}
        </div>

        <div class="quiz-question">
            ${currentQuestion + 1}.
            ${q.question}
        </div>

        <div class="quiz-options">
    `;


    q.options.forEach(
        function (option, index) {

            html += `

                <button
                    class="quiz-option"
                    onclick="answerQuiz(${index})"
                >
                    ${option}
                </button>

            `;
        }
    );


    html += `</div>`;


    area.innerHTML = html;
}


function answerQuiz(selected) {

    const question =
        shuffledQuestions[currentQuestion];


    if (selected === question.answer) {

        quizScore++;

        alert("✅ Correct!");

        currentQuestion++;

        showQuizQuestion();

    } else {

        alert(
            "❌ Wrong answer! Try this question again."
        );

        // User stays on the same question.
    }
}


// ======================================================
// INITIALIZATION
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        console.log(
            "✨ LifePilot AI loaded successfully."
        );

    }
);