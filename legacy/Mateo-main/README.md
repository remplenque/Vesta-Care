# 🤖 Mateo - Conversational Agent

**Project developed for the first AI Agents hackathon in Chile | October 25, 2025**

---

**An AI "digital nephew" designed for the companionship and cognitive stimulation of the elderly.**

This project creates a conversational AI agent that adopts the personality of "Mateo," a 15-year-old nephew. Its objective is to converse with elderly users ("Mr. Juanito" or "Mrs. María") about the news, validating their experience and combating loneliness.

---

## 🚀 Project Description

**"Mateo"** is a conversational AI agent designed to combat loneliness and provide cognitive stimulation for the elderly, acting as a patient, respectful, and curious "digital nephew."

* **Problem:** Unwanted loneliness is a growing problem among the elderly population, directly impacting their mental and cognitive health. Many technological tools are impersonal, frustrating, or not designed to *converse*, but only to *answer questions*.
* **Solution:** "Mateo" solves this by simulating a human and familiar interaction. Using a news headline as a starting point, the agent focuses on "stretching out the conversation," asking deep follow-up questions that validate the user's experience and wisdom. It is built with **Pydantic AI** for robust control of the conversation flow (checkpoints, redirects) and uses **Google Gemini** as the LLM, along with **ElevenLabs** for natural voice interaction.
* **Vision:** The long-term goal is for "Mateo" to be a customizable AI companion, capable of remembering past conversations and specific interests of each user (like "Mr. Juanito" or "Mrs. María"). It could be integrated into assistance applications or home devices to offer daily, active companionship, improving the quality of life for the elderly.

---

## ✨ Key Features

* **Defined Persona:** Acts as "Mateo," a curious 15-year-old nephew.
* **Natural Voice:** Uses **ElevenLabs** to generate realistic and warm audio.
* **Deep Conversation:** Logic designed to "stretch out the conversation" by asking follow-up questions (`IMPACT`, `OPINION`, `EXPERIENCE`).
* **Controlled Flow:** Uses a `CHECKPOINT` to give control back to the user and decide whether to continue or change topics.
* **Error Handling:** Includes a `REDIRECT` type to get the conversation back on track if the user gives irrelevant answers.
* **Proactive Transitions:** Capable of proposing new conversation topics (`NEW_TOPIC`) based on user profiles if requested.
* **Flexible Obedience:** Understands numerical instructions like "ask me two more questions."

---

## 🛠️ Technologies Used

* **Backend:** Flask
* **Language:** Python
* **AI Model (LLM):** Google Gemini (`gemini-2.5-flash`)
* **Agent Framework:** Pydantic AI
* **Voice Generation (TTS):** ElevenLabs
* **News Service:** GNews.io

---

## 🔑 Requirements

To run this project, you will need to set up the following API keys as environment variables. You can create a `.env` file in the root of the project to store them.

```bash
GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY"
GNEWS_API_KEY="YOUR_GNEWS_API_KEY"
ELEVENLABS_API_KEY="YOUR_ELEVENLABS_API_KEY"
SENDGRID_API_KEY="YOUR_SENDGRID_API_KEY"
```

## 👥 The Team

We are **IADEVSUDD**, students of Computer Civil Engineering and Technological Innovation at the Universidad del Desarrollo (UDD), passionate about creating innovative solutions with AI.

* **Vicente Rodríguez** | [@github-vicente](https://github.com/remplenque)
* **Baptiste Vial** | [@github-baptiste](https://github.com/bato21)
* **Alessandro Lavezzi** | [@github-alessandro](https://github.com/iskandar-lagrange)

