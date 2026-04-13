import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const stations = ["Shell", "Engen", "BP", "Total", "Sasol"];

export default function TankItApp() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [amount, setAmount] = useState("");
  const [station, setStation] = useState("");

  const [budget, setBudget] = useState(0);
  const [budgetInput, setBudgetInput] = useState("");

  const [preferredStation, setPreferredStation] = useState("");
  const [points, setPoints] = useState(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();
          setBalance(data.balance || 0);
          setTransactions(data.transactions || []);
          setBudget(data.budget || 0);
          setPreferredStation(data.preferredStation || "");
          setPoints(data.points || 0);
        } else {
          await setDoc(ref, {
            balance: 0,
            transactions: [],
            budget: 0,
            preferredStation: "",
            points: 0,
          });
        }
      } else {
        setUser(null);
      }
    });

    return () => unsub();
  }, []);

  const updateUserData = async (data) => {
    const ref = doc(db, "users", user.uid);
    await updateDoc(ref, data);
  };

  const addFunds = async () => {
    const value = parseFloat(amount);
    if (!value) return;

    const newBalance = balance + value;
    const tx = {
      type: "Deposit",
      amount: value,
      station: "-",
      date: new Date().toLocaleString(),
    };

    setBalance(newBalance);
    setTransactions([tx, ...transactions]);
    await updateUserData({
      balance: newBalance,
      transactions: arrayUnion(tx),
    });
    setAmount("");
  };

  const payFuel = async () => {
    const value = parseFloat(amount);
    if (!value || value > balance) return;

    let reward = 0;
    if (station === preferredStation) {
      reward = Math.floor(value * 0.05); // 5% reward
    }

    const newBalance = balance - value;
    const newPoints = points + reward;

    const tx = {
      type: "Fuel",
      amount: value,
      station,
      reward,
      date: new Date().toLocaleString(),
    };

    setBalance(newBalance);
    setPoints(newPoints);
    setTransactions([tx, ...transactions]);

    await updateUserData({
      balance: newBalance,
      points: newPoints,
      transactions: arrayUnion(tx),
    });

    setAmount("");
    setStation("");
  };

  const setMonthlyBudget = async () => {
    const value = parseFloat(budgetInput);
    if (!value) return;
    setBudget(value);
    await updateUserData({ budget: value });
    setBudgetInput("");
  };

  const setPreferred = async (s) => {
    setPreferredStation(s);
    await updateUserData({ preferredStation: s });
  };

  const fuelSpent = transactions
    .filter((t) => t.type === "Fuel")
    .reduce((sum, t) => sum + t.amount, 0);

  const percentage = budget ? Math.min((fuelSpent / budget) * 100, 100) : 0;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="p-6">
          <input placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="Password" type="password" onChange={(e) => setPassword(e.target.value)} />
          <button onClick={() => signInWithEmailAndPassword(auth, email, password)}>Login</button>
          <button onClick={() => createUserWithEmailAndPassword(auth, email, password)}>Register</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 text-white bg-black min-h-screen">
      <h1 className="text-2xl mb-4">Tank It ⛽</h1>

      {/* BALANCE */}
      <div className="mb-4">
        <p>Balance: R{balance}</p>
        <p>Points: {points}</p>
      </div>

      {/* PREFERRED STATION */}
      <div className="mb-4">
        <p className="mb-2">Select Preferred Station</p>
        <div className="flex gap-2 flex-wrap">
          {stations.map((s) => (
            <button
              key={s}
              onClick={() => setPreferred(s)}
              className={`p-2 rounded ${preferredStation === s ? "bg-green-500" : "bg-gray-700"}`}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="text-sm mt-2">Use your preferred station to earn rewards</p>
      </div>

      {/* BUDGET */}
      <div className="mb-4">
        <p>Budget: R{budget}</p>
        <p>Used: {percentage.toFixed(0)}%</p>
      </div>

      {/* INPUT */}
      <input placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />

      <select value={station} onChange={(e) => setStation(e.target.value)}>
        <option value="">Select Station</option>
        {stations.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>

      <div className="flex gap-2 mt-2">
        <button onClick={addFunds}>Add</button>
        <button onClick={payFuel}>Pay</button>
      </div>

      {/* TRANSACTIONS */}
      <div className="mt-4">
        {transactions.map((t, i) => (
          <div key={i}>
            <p>{t.type} - R{t.amount} ({t.station}) +{t.reward || 0} pts</p>
          </div>
        ))}
      </div>
    </div>
  );
}
