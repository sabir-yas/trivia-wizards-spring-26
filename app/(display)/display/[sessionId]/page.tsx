"use client";

import { useState, useEffect, use } from "react";
import { useSocket } from "@/components/shared/SocketProvider";
import { useSound } from "@/hooks/useSound";
import type {
  GameQuestionStartPayload,
  GameAnswerRevealPayload,
  TeamScore,
} from "@/types/socket-events";

type DisplayState = "lobby" | "question" | "reveal" | "leaderboard" | "ended";

export default function DisplayPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const socket = useSocket();
  const sound = useSound();

  const [displayState, setDisplayState] = useState<DisplayState>("lobby");
  const [question, setQuestion] = useState<GameQuestionStartPayload | null>(null);
  const [reveal, setReveal] = useState<GameAnswerRevealPayload | null>(null);
  const [leaderboard, setLeaderboard] = useState<TeamScore[]>([]);
  const [timer, setTimer] = useState<number | null>(null);
  const [sessionName, setSessionName] = useState<string>("");

  useEffect(() => {
    // Load session name
    fetch(`/api/sessions/${sessionId}`)
      .then(r => r.json())
      .then(d => setSessionName(d.data?.sessionName ?? "Trivia Night"))
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    socket.emit("display:join-session", { sessionId });

    socket.on("game:state-changed", ({ status }) => {
      if (status === "LOBBY") setDisplayState("lobby");
      if (status === "COMPLETED") setDisplayState("ended");
    });

    socket.on("game:round-started", () => {
      setDisplayState("lobby");
      setQuestion(null);
      setReveal(null);
      sound.roundStart();
    });

    socket.on("game:question-start", (payload) => {
      setQuestion(payload);
      setReveal(null);
      setTimer(payload.timeLimit);
      setDisplayState("question");
      sound.questionStart();
    });

    socket.on("timer:tick", ({ secondsRemaining }) => {
      setTimer(secondsRemaining);
      if (secondsRemaining <= 5 && secondsRemaining > 0) {
        sound.urgentTick();
      } else if (secondsRemaining > 5) {
        sound.tick();
      }
    });
    socket.on("timer:expired", () => {
      setTimer(0);
      sound.timerExpired();
    });

    socket.on("game:answer-reveal", (payload) => {
      setReveal(payload);
      setLeaderboard(payload.scores);
      setDisplayState("reveal");
      sound.answerReveal();
    });

    socket.on("game:round-ended", ({ leaderboard }) => {
      setLeaderboard(leaderboard);
      setDisplayState("leaderboard");
      sound.roundEnd();
    });

    socket.on("game:session-ended", ({ finalLeaderboard }) => {
      setLeaderboard(finalLeaderboard);
      setDisplayState("ended");
      sound.gameOver();
    });

    return () => {
      socket.off("game:state-changed");
      socket.off("game:round-started");
      socket.off("game:question-start");
      socket.off("timer:tick");
      socket.off("timer:expired");
      socket.off("game:answer-reveal");
      socket.off("game:round-ended");
      socket.off("game:session-ended");
    };
  }, [socket, sessionId]);

  const optionLabels = ["A", "B", "C", "D", "E", "F"];
  const optionColors = ["bg-blue-600", "bg-orange-600", "bg-green-600", "bg-red-600", "bg-purple-600", "bg-pink-600"];

  // Lobby
  if (displayState === "lobby") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-12">
        <div className="text-8xl mb-8">🎩</div>
        <h1 className="text-7xl font-bold text-purple-400 mb-4">Trivia Wizards</h1>
        <p className="text-4xl text-gray-300 mb-2">{sessionName}</p>
        <p className="text-2xl text-gray-500 mt-6">Get ready — game starting soon!</p>
        <div className="flex gap-2 mt-8">
          {[0,1,2].map(i => (
            <div key={i} className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    );
  }

  // Active question
  if (displayState === "question" && question) {
    return (
      <div className="min-h-screen flex flex-col p-10">
        {/* Timer */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl text-gray-400">Question {question.orderIndex + 1} / {question.totalQuestions}</span>
            <span className={`text-6xl font-bold ${timer !== null && timer <= 5 ? "text-red-400 animate-pulse" : "text-white"}`}>
              {timer ?? question.timeLimit}
            </span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-4">
            <div
              className={`h-4 rounded-full transition-all duration-1000 ${timer !== null && timer <= 5 ? "bg-red-500" : "bg-purple-500"}`}
              style={{ width: `${Math.max(0, ((timer ?? question.timeLimit) / question.timeLimit) * 100)}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="flex-1 flex flex-col justify-center">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-10 mb-8 text-center">
            <p className="text-5xl font-bold text-white leading-tight">{question.questionText}</p>
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-5">
            {question.options.map((opt, i) => (
              <div key={i} className={`${optionColors[i % optionColors.length]} rounded-2xl p-6 flex items-center gap-4`}>
                <span className="w-12 h-12 rounded-full bg-black/30 flex items-center justify-center text-xl font-bold shrink-0">
                  {optionLabels[i]}
                </span>
                <span className="text-2xl font-semibold">{opt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Reveal
  if (displayState === "reveal" && reveal && question) {
    return (
      <div className="min-h-screen flex flex-col p-10">
        <div className="mb-8 text-center">
          <p className="text-3xl text-gray-400 mb-4">{question.questionText}</p>
          <div className="inline-block bg-green-600 rounded-2xl px-10 py-5">
            <p className="text-2xl text-green-100 mb-1">Correct Answer</p>
            <p className="text-5xl font-bold text-white">{reveal.correctAnswer}</p>
          </div>
        </div>

        {/* Mini leaderboard */}
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-gray-300 mb-4 text-center">Scoreboard</h3>
          <div className="max-w-2xl mx-auto space-y-3">
            {reveal.scores.slice(0, 8).map((team, i) => (
              <div key={team.teamId} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-6 py-4">
                <div className="flex items-center gap-4">
                  <span className={`text-2xl font-bold w-8 text-center ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-orange-400" : "text-gray-500"}`}>
                    {i + 1}
                  </span>
                  <span className="text-xl text-white">{team.teamName}</span>
                </div>
                <span className="text-2xl font-bold text-purple-300">{team.totalScore}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Mid-round leaderboard
  if (displayState === "leaderboard") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-10">
        <h2 className="text-5xl font-bold mb-2 text-center">📊 Leaderboard</h2>
        <p className="text-gray-400 text-xl mb-10">{sessionName}</p>
        <div className="w-full max-w-2xl space-y-4">
          {leaderboard.slice(0, 10).map((team, i) => (
            <div
              key={team.teamId}
              className={`flex items-center justify-between rounded-2xl px-8 py-5 ${
                i === 0 ? "bg-yellow-600/30 border-2 border-yellow-500" :
                i === 1 ? "bg-gray-400/10 border-2 border-gray-500" :
                i === 2 ? "bg-orange-700/20 border-2 border-orange-600" :
                "bg-gray-900 border border-gray-800"
              }`}
            >
              <div className="flex items-center gap-5">
                <span className="text-4xl">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                </span>
                <span className="text-3xl font-bold text-white">{team.teamName}</span>
                {team.tableNumber && <span className="text-gray-400 text-lg">Table {team.tableNumber}</span>}
              </div>
              <span className="text-4xl font-bold text-purple-300">{team.totalScore}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Final results podium
  if (displayState === "ended") {
    const [first, second, third] = leaderboard;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-10 text-center">
        <div className="text-7xl mb-4">🏆</div>
        <h2 className="text-6xl font-bold text-white mb-2">Final Results</h2>
        <p className="text-gray-400 text-2xl mb-16">{sessionName}</p>

        {/* Podium — 2nd, 1st, 3rd side by side */}
        <div className="flex items-end justify-center gap-6 mb-12">
          {/* 2nd place */}
          {second && (
            <div className="flex flex-col items-center gap-3">
              <span className="text-5xl">🥈</span>
              <div className="bg-gray-400/20 border-2 border-gray-400 rounded-t-3xl px-8 py-6 w-48 h-40 flex flex-col justify-center">
                <p className="text-white font-bold text-xl leading-tight">{second.teamName}</p>
                {second.tableNumber && <p className="text-gray-400 text-sm mt-1">Table {second.tableNumber}</p>}
                <p className="text-gray-200 text-3xl font-bold mt-2">{second.totalScore}</p>
                <p className="text-gray-400 text-sm">pts</p>
              </div>
            </div>
          )}

          {/* 1st place — tallest */}
          {first && (
            <div className="flex flex-col items-center gap-3">
              <span className="text-7xl animate-bounce">🥇</span>
              <div className="bg-yellow-600/40 border-2 border-yellow-400 rounded-t-3xl px-10 py-8 w-56 h-52 flex flex-col justify-center">
                <p className="text-white font-bold text-2xl leading-tight">{first.teamName}</p>
                {first.tableNumber && <p className="text-yellow-300/70 text-sm mt-1">Table {first.tableNumber}</p>}
                <p className="text-yellow-300 text-4xl font-bold mt-2">{first.totalScore}</p>
                <p className="text-yellow-400 text-sm">pts</p>
              </div>
            </div>
          )}

          {/* 3rd place */}
          {third && (
            <div className="flex flex-col items-center gap-3">
              <span className="text-5xl">🥉</span>
              <div className="bg-orange-700/20 border-2 border-orange-500 rounded-t-3xl px-8 py-6 w-48 h-32 flex flex-col justify-center">
                <p className="text-white font-bold text-xl leading-tight">{third.teamName}</p>
                {third.tableNumber && <p className="text-orange-300/70 text-sm mt-1">Table {third.tableNumber}</p>}
                <p className="text-orange-300 text-3xl font-bold mt-2">{third.totalScore}</p>
                <p className="text-orange-400 text-sm">pts</p>
              </div>
            </div>
          )}
        </div>

        {/* Rest of the teams */}
        {leaderboard.length > 3 && (
          <div className="w-full max-w-lg space-y-3">
            {leaderboard.slice(3).map((team, i) => (
              <div key={team.teamId} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-2xl px-6 py-3">
                <div className="flex items-center gap-4">
                  <span className="text-gray-500 text-xl w-8">{i + 4}.</span>
                  <span className="text-xl text-white">{team.teamName}</span>
                </div>
                <span className="text-xl font-bold text-purple-300">{team.totalScore}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-gray-600 text-xl mt-12">Thanks for playing Trivia Wizards!</p>
      </div>
    );
  }

  return null;
}
