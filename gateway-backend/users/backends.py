from django.contrib.auth.backends import ModelBackend


class EmailBackend(ModelBackend):
    """
    Sign in with an email address, ignoring case and surrounding spaces
    (emails are stored lower-cased). Used by the API login and the Django
    admin alike.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):

        identifier = username if username is not None else kwargs.get("email")

        if identifier is None:
            return None

        return super().authenticate(
            request,
            username=str(identifier).strip().lower(),
            password=password,
            **kwargs
        )
