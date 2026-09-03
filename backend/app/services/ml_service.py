from app.ml.anomaly_detector import AccessAnomalyDetector
from app.ml.feature_engineering import build_user_features
from app.ml.risk_engine import RiskEngine


FEATURE_COLUMNS = [
    "total_accesses",
    "allowed_accesses",
    "denied_accesses",
    "unique_patients",
    "unique_documents",
    "view_count",
    "average_access_hour",
    "night_access_count",
]


class MLRiskService:

    # Minimum number of access events required
    # before making an ML-based behavioral decision.
    MINIMUM_ACCESS_HISTORY = 10

    def __init__(self):
        self.detector = AccessAnomalyDetector(
            contamination=0.15,
            random_state=42,
        )

        self.risk_engine = RiskEngine()

    def train(self, training_data):
        """
        Train the Isolation Forest model.
        """

        feature_matrix = training_data[
            FEATURE_COLUMNS
        ].values

        self.detector.train(
            feature_matrix
        )

    def analyze_user(
        self,
        db,
        user_id: int,
    ):
        """
        Analyze the historical behavior
        of a healthcare user.
        """

        features = build_user_features(
            db=db,
            user_id=user_id,
        )

        # No historical access data
        if not features:
            return {
                "status": "INSUFFICIENT_DATA",
                "message": (
                    "No access history found "
                    "for this user."
                ),
            }

        # Not enough history for reliable
        # behavioral analysis
        if (
            features["total_accesses"]
            < self.MINIMUM_ACCESS_HISTORY
        ):
            return {
                "status": "INSUFFICIENT_DATA",
                "message": (
                    f"At least "
                    f"{self.MINIMUM_ACCESS_HISTORY} "
                    f"access events are required "
                    f"for ML-based risk analysis."
                ),
                "current_accesses": features[
                    "total_accesses"
                ],
            }

        # ---------------------------------------------------------
        # Create feature vector for the ML model
        # ---------------------------------------------------------

        feature_vector = [
            features[column]
            for column in FEATURE_COLUMNS
        ]

        # ---------------------------------------------------------
        # Isolation Forest prediction
        # ---------------------------------------------------------

        prediction = self.detector.predict(
            feature_vector
        )

        # ---------------------------------------------------------
        # Isolation Forest anomaly score
        # ---------------------------------------------------------

        anomaly_score = (
            self.detector.anomaly_score(
                feature_vector
            )
        )

        # ---------------------------------------------------------
        # Behavioral risk score
        #
        # The risk engine now considers both:
        # 1. ML anomaly score
        # 2. Behavioral features
        # ---------------------------------------------------------

        risk_score = (
            self.risk_engine.calculate_risk_score(
                anomaly_score,
                features,
            )
        )

        # ---------------------------------------------------------
        # Determine risk level
        # ---------------------------------------------------------

        risk_level = (
            self.risk_engine.get_risk_level(
                risk_score
            )
        )

        # ---------------------------------------------------------
        # Determine security action
        # ---------------------------------------------------------

        security_action = (
            self.risk_engine.get_security_action(
                risk_score
            )
        )

        # ---------------------------------------------------------
        # Return complete analysis
        # ---------------------------------------------------------

        return {
            "status": "ANALYZED",
            "user_id": user_id,
            "features": features,
            "prediction": (
                "ANOMALOUS"
                if prediction == -1
                else "NORMAL"
            ),
            "anomaly_score": round(
                anomaly_score,
                4,
            ),
            "risk_score": risk_score,
            "risk_level": risk_level,
            "security_action": security_action,
        }