import firebase_admin
import logging
import os
from firebase_admin import auth


def lambda_handler(event, context):
    logger = logging.getLogger()
    logger.setLevel(str(os.getenv("LOGGING_LEVEL", "WARN")))
    logger.debug(event)
    # sdk初期化
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    try:
        # 正規のトークンでない場合エラーになる
        decoded_token = auth.verify_id_token(event["Token"])
        logger.debug(decoded_token)
        uid = decoded_token["uid"]
        # 許可
        return {
            "principalId": uid,
            "policyDocument": {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Action": "*",
                        "Effect": "Allow",
                        "Resource": "arn:aws:execute-api:*:*:*/*/*/",
                    }
                ],
            },
        }
    except (
        KeyError,
        auth.InvalidIdTokenError,
        auth.ExpiredIdTokenError,
        auth.RevokedIdTokenError,
        auth.CertificateFetchError,
        auth.UserDisabledError,
    ) as e:
        logging.error(e)
        return {
            "principalId": "0",
            "policyDocument": {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Action": "*",
                        "Effect": "Deny",
                        "Resource": "arn:aws:execute-api:*:*:*/*/*/",
                    }
                ],
            },
        }
