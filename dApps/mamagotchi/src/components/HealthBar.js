import React, { useEffect, useState } from 'react';
import '../css/HealthBar.css';
import { calculateDecay } from '../utils';
import { HEALTH_DECAY_RATE } from '../constants';

const HealthBar = ({ initialHealth = 0, lastInteraction }) => {
  const [currentHealth, setCurrentHealth] = useState(initialHealth);

  useEffect(() => {
    // Function to update health periodically
    const updateHealth = () => {
      const updatedHealth = calculateDecay(
        initialHealth,
        lastInteraction,
        HEALTH_DECAY_RATE
      ); // Decay rate: 5.5 per hour
      const validatedHealth =
        !isNaN(updatedHealth) && updatedHealth >= 0 ? updatedHealth : 0; // Ensure valid health
      setCurrentHealth(validatedHealth);
    };

    // Initial update when the component loads
    updateHealth();

    // Set up an interval to update health every second
    const intervalId = setInterval(updateHealth, 1000); // Update health every 1 second

    // Cleanup the interval when the component unmounts
    return () => clearInterval(intervalId);
  }, [initialHealth, lastInteraction]); // Re-run effect if initialHealth or lastInteraction changes

  // Calculate percentage for health bar width
  const healthPercentage = Math.ceil(currentHealth);

  return (
    <div className="health-bar-container">
      <div
        className="health-bar"
        style={{ width: `${healthPercentage}%` }}
      ></div>
      <p className="health-text">{`${healthPercentage} / 100`}</p>
    </div>
  );
};

export default HealthBar;
