package com.example.brevityjobs

import kotlinx.serialization.Serializable

@Serializable
sealed interface BrevityNavKey

@Serializable
data object LoginKey : BrevityNavKey

@Serializable
data class AgentOnboardingKey(val email: String) : BrevityNavKey

@Serializable
data object SeekerFeedKey : BrevityNavKey

@Serializable
data object ProfileSettingsKey : BrevityNavKey

@Serializable
data object AboutUsKey : BrevityNavKey

@Serializable
data class ApplicationWebKey(val url: String, val title: String) : BrevityNavKey
