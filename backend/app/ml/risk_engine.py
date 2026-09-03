from app.ml.anomaly_detector import AccessAnomalyDetector


class RiskEngine:

    def __init__(self):
        # Compatibility with the existing architecture.
        # The trained detector itself is maintained by MLRiskService.
        self.detector = AccessAnomalyDetector(
            contamination=0.15,
            random_state=42,
        )

    def calculate_behavior_score(
        self,
        features: dict,
    ) -> float:
        """
        Calculate behavioral severity from 0-100.

        Higher score means more suspicious behavior.
        """

        total_accesses = features.get(
            "total_accesses", 0
        )

        unique_patients = features.get(
            "unique_patients", 0
        )

        unique_documents = features.get(
            "unique_documents", 0
        )

        night_accesses = features.get(
            "night_access_count", 0
        )

        denied_accesses = features.get(
            "denied_accesses", 0
        )

        # ---------------------------------------------------------
        # Access volume score: 0-100
        # ---------------------------------------------------------

        volume_score = min(
            100,
            (total_accesses / 100) * 100,
        )

        # ---------------------------------------------------------
        # Patient diversity score: 0-100
        # ---------------------------------------------------------

        patient_score = min(
            100,
            (unique_patients / 50) * 100,
        )

        # ---------------------------------------------------------
        # Document diversity score: 0-100
        # ---------------------------------------------------------

        document_score = min(
            100,
            (unique_documents / 50) * 100,
        )

        # ---------------------------------------------------------
        # Night activity score: 0-100
        # ---------------------------------------------------------

        night_score = min(
            100,
            (night_accesses / 50) * 100,
        )

        # ---------------------------------------------------------
        # Denied access score: 0-100
        # ---------------------------------------------------------

        denied_score = min(
            100,
            (denied_accesses / 20) * 100,
        )

        # ---------------------------------------------------------
        # Weighted behavioral severity
        # ---------------------------------------------------------

        behavior_score = (
            (volume_score * 0.25)
            + (patient_score * 0.20)
            + (document_score * 0.15)
            + (night_score * 0.20)
            + (denied_score * 0.20)
        )

        return round(
            min(100, behavior_score),
            2,
        )

    def calculate_risk_score(
        self,
        anomaly_score: float,
        features: dict,
    ) -> float:
        """
        Combine the ML anomaly signal and
        behavioral severity into a 0-100 risk score.
        """

        # ---------------------------------------------------------
        # ML anomaly component
        # ---------------------------------------------------------

        ml_risk = (
            0.5 - anomaly_score
        ) * 100

        ml_risk = max(
            0,
            min(100, ml_risk),
        )

        # ---------------------------------------------------------
        # Behavioral component
        # ---------------------------------------------------------

        behavior_score = (
            self.calculate_behavior_score(
                features
            )
        )

        # ---------------------------------------------------------
        # Final risk score
        #
        # 40% ML anomaly signal
        # 60% behavioral severity
        # ---------------------------------------------------------

        risk_score = (
            (ml_risk * 0.40)
            + (behavior_score * 0.60)
        )

        return round(
            max(0, min(100, risk_score)),
            2,
        )

    def get_risk_level(
        self,
        risk_score: float,
    ) -> str:

        if risk_score < 40:
            return "LOW"

        if risk_score < 70:
            return "MEDIUM"

        return "HIGH"

    def get_security_action(
        self,
        risk_score: float,
    ) -> str:

        if risk_score < 40:
            return "ALLOW"

        if risk_score < 70:
            return "MFA_REQUIRED"

        return "DENY"