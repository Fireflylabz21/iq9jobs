package com.fireflylabz.devaitjobs.ui.auth

import android.content.Intent
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import android.util.Log
import dagger.hilt.android.lifecycle.HiltViewModel
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.fireflylabz.devaitjobs.domain.repository.ProfileRepository
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val isCreatingAccount: Boolean = false,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val infoMessage: String? = null
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val firebaseAuth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
    private val profileRepository: ProfileRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    fun resumeExistingSession(onSuccess: (String, Boolean) -> Unit) {
        viewModelScope.launch {
            val user = firebaseAuth.currentUser ?: return@launch
            try {
                onSuccess(user.email.orEmpty(), profileRepository.hasCompletedOnboarding(user.email.orEmpty()))
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                Log.e("LoginViewModel", "Failed to check onboarding completion", error)
                reportGoogleSignInError(
                    error.localizedMessage ?: "Could not load your account profile."
                )
            }
        }
    }

    fun updateEmail(email: String) {
        _uiState.update { it.copy(email = email, errorMessage = null, infoMessage = null) }
    }

    fun updatePassword(password: String) {
        _uiState.update { it.copy(password = password, errorMessage = null, infoMessage = null) }
    }

    fun setCreatingAccount(isCreatingAccount: Boolean) {
        _uiState.update {
            it.copy(
                isCreatingAccount = isCreatingAccount,
                errorMessage = null,
                infoMessage = null
            )
        }
    }

    fun login(onSuccess: (String, Boolean) -> Unit) {
        authenticate(onSuccess) {
            firebaseAuth.signInWithEmailAndPassword(it.first, it.second).await()
        }
    }

    fun createAccount(onSuccess: (String, Boolean) -> Unit) {
        authenticate(onSuccess) {
            firebaseAuth.createUserWithEmailAndPassword(it.first, it.second).await()
        }
    }

    fun signInWithGoogleResult(intent: Intent?, onSuccess: (String, Boolean) -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null, infoMessage = null) }
            try {
                val account = GoogleSignIn.getSignedInAccountFromIntent(intent).await()
                val idToken = account.idToken
                    ?: error("Google did not return an ID token. Check the Firebase OAuth client setup.")
                val credential = GoogleAuthProvider.getCredential(idToken, null)
                firebaseAuth.signInWithCredential(credential).await()
                val user = firebaseAuth.currentUser ?: error("Firebase did not return a signed-in user.")
                saveUserDocument(user.uid, user.email, user.displayName, "google.com")
                _uiState.update { it.copy(isLoading = false) }
                onSuccess(
                    user.email.orEmpty(),
                    profileRepository.hasCompletedOnboarding(user.email.orEmpty())
                )
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                Log.e("LoginViewModel", "Google sign-in failed", error)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = error.localizedMessage ?: "Google sign-in failed. Please try again."
                    )
                }
            }
        }
    }

    fun reportGoogleSignInError(message: String) {
        _uiState.update { it.copy(errorMessage = message, isLoading = false) }
    }

    private fun authenticate(
        onSuccess: (String, Boolean) -> Unit,
        operation: suspend (Pair<String, String>) -> Unit
    ) {
        viewModelScope.launch {
            val email = _uiState.value.email.trim()
            val password = _uiState.value.password
            if (email.isBlank() || password.isBlank()) {
                _uiState.update { it.copy(errorMessage = "Enter your email and password") }
                return@launch
            }

            _uiState.update { it.copy(isLoading = true, errorMessage = null, infoMessage = null) }
            try {
                operation(email to password)
                val user = firebaseAuth.currentUser ?: error("Firebase did not return a signed-in user.")
                saveUserDocument(
                    user.uid,
                    user.email,
                    user.displayName,
                    user.providerData.firstOrNull { it.providerId != "firebase" }?.providerId ?: "password"
                )
                _uiState.update { it.copy(isLoading = false) }
                onSuccess(
                    user.email.orEmpty(),
                    profileRepository.hasCompletedOnboarding(user.email.orEmpty())
                )
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                Log.e("LoginViewModel", "Firebase authentication failed", error)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = error.localizedMessage ?: "Authentication failed. Please try again."
                    )
                }
            }
        }
    }

    private suspend fun saveUserDocument(
        uid: String,
        email: String?,
        displayName: String?,
        provider: String
    ) {
        val reference = firestore.collection("users").document(uid)
        val exists = reference.get().await().exists()
        val userData = mutableMapOf<String, Any>(
            "uid" to uid,
            "email" to email.orEmpty(),
            "provider" to provider,
            "lastSignInAt" to com.google.firebase.firestore.FieldValue.serverTimestamp()
        )
        displayName?.let { userData["displayName"] = it }
        if (!exists) userData["createdAt"] = com.google.firebase.firestore.FieldValue.serverTimestamp()
        reference.set(userData, SetOptions.merge()).await()
    }

    fun sendPasswordReset() {
        viewModelScope.launch {
            val email = _uiState.value.email.trim()
            if (email.isBlank()) {
                _uiState.update { it.copy(errorMessage = "Enter your email address first") }
                return@launch
            }
            _uiState.update { it.copy(isLoading = true, errorMessage = null, infoMessage = null) }
            try {
                firebaseAuth.sendPasswordResetEmail(email).await()
                _uiState.update {
                    it.copy(isLoading = false, infoMessage = "Password reset email sent")
                }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                Log.e("LoginViewModel", "Firebase password reset failed", error)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = error.localizedMessage ?: "Could not send password reset email."
                    )
                }
            }
        }
    }
}

