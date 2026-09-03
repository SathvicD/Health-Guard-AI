from sklearn.ensemble import IsolationForest
import numpy as np


class AccessAnomalyDetector:
    """
    Isolation Forest model for detecting
    unusual healthcare data access behavior.
    """

    def __init__(
        self,
        contamination: float = 0.15,
        random_state: int = 42,
    ):
        self.model = IsolationForest(
            contamination=contamination,
            random_state=random_state,
            n_estimators=100,
        )

        self.is_trained = False

    def train(self, feature_matrix):
        """
        Train the Isolation Forest model.

        feature_matrix should contain behavioral
        features for multiple users/access patterns.
        """

        if len(feature_matrix) < 2:
            raise ValueError(
                "At least 2 samples are required to train the model."
            )

        self.model.fit(feature_matrix)
        self.is_trained = True

    def predict(self, feature_vector):
        """
        Predict whether a behavior is normal or anomalous.

        Returns:
            1  -> Normal
           -1  -> Anomalous
        """

        if not self.is_trained:
            raise ValueError(
                "Model has not been trained yet."
            )

        prediction = self.model.predict(
            np.array(feature_vector).reshape(1, -1)
        )

        return int(prediction[0])

    def anomaly_score(self, feature_vector):
        """
        Return the Isolation Forest anomaly score.

        Higher values generally represent more normal behavior.
        Lower values represent more anomalous behavior.
        """

        if not self.is_trained:
            raise ValueError(
                "Model has not been trained yet."
            )

        score = self.model.decision_function(
            np.array(feature_vector).reshape(1, -1)
        )

        return float(score[0])