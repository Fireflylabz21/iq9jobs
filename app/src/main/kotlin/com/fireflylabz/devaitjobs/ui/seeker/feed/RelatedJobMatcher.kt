package com.fireflylabz.devaitjobs.ui.seeker.feed

import com.fireflylabz.devaitjobs.domain.model.JobPost
import com.fireflylabz.devaitjobs.domain.model.SeekerProfile

internal object RelatedJobMatcher {
    private val ignoredRoleWords = setOf(
        "associate", "developer", "engineer", "entry", "experienced", "junior", "lead",
        "manager", "mid", "principal", "senior", "specialist", "staff"
    )
    private val skillFamilies = listOf(
        setOf("kotlin", "java", "android"),
        setOf("javascript", "js", "typescript", "ts"),
        setOf("react", "reactjs", "react js"),
        setOf("jetpack compose", "compose"),
        setOf("machine learning", "ml", "ai"),
        setOf("aws", "amazon web services"),
        setOf("gcp", "google cloud", "google cloud platform"),
        setOf("postgres", "postgresql")
    )
    private val roleFamilies = listOf(
        setOf("presales", "pre sales", "sales", "business development", "biz dev",
            "business development representative", "bdr", "sales development",
            "sales development representative", "sdr", "account executive"),
        setOf("android", "mobile", "kotlin"),
        setOf("ios", "mobile", "swift"),
        setOf("backend", "server", "api"),
        setOf("frontend", "front end", "web", "ui"),
        setOf("fullstack", "full stack"),
        setOf("data", "analytics", "machine learning", "ml", "ai"),
        setOf("devops", "sre", "platform", "cloud"),
        setOf("qa", "quality", "testing", "test"),
        setOf("product", "product owner"),
        setOf("ux", "ui ux", "design", "designer")
    )

    fun match(jobs: List<JobPost>, profile: SeekerProfile): List<JobPost> {
        val role = normalize(profile.targetTitle)
        val roleTerms = tokens(role).filterNot(ignoredRoleWords::contains)
        val skills = profile.topSkills.map(::normalize).filter(String::isNotBlank)
        val hasRoleOrSkillCriteria = roleTerms.isNotEmpty() || skills.isNotEmpty()

        val relevantJobs = jobs.mapIndexedNotNull { index, job ->
            val roleScore = roleScore(role, roleTerms, job.title)
            val skillScore = skillScore(skills, job.coreSkills)
            val isRelevant = if (hasRoleOrSkillCriteria) {
                roleScore > 0 || skillScore > 0
            } else {
                false
            }
            if (isRelevant) {
                ScoredJob(job, roleScore + skillScore, index)
            } else {
                null
            }
        }

        val locationTiers = locationTiers(profile.expectedLocation)
        val selectedTier = locationTiers.firstOrNull { tier ->
            relevantJobs.any { it.job.matchesAnyCity(tier) }
        }
        val locationFilteredJobs = when {
            selectedTier != null -> relevantJobs.filter { it.job.matchesAnyCity(selectedTier) }
            locationTiers.isEmpty() -> relevantJobs
            else -> emptyList()
        }

        return locationFilteredJobs
            .sortedWith(compareByDescending<ScoredJob> { it.score }.thenBy { it.originalIndex })
            .map(ScoredJob::job)
    }

    private fun roleScore(profileRole: String, roleTerms: List<String>, jobTitle: String): Int {
        val normalizedJobTitle = normalize(jobTitle)
        if (profileRole.isBlank() || normalizedJobTitle.isBlank()) return 0

        val exactPhraseMatch = roleTerms.any { term ->
            normalizedJobTitle.containsPhrase(term)
        }
        if (exactPhraseMatch) return 6

        val isRelatedRole = roleFamilies.any { family ->
            family.any { profileRole.containsPhrase(it) } &&
                family.any { normalizedJobTitle.containsPhrase(it) }
        }
        return if (isRelatedRole) 4 else 0
    }

    private fun skillScore(profileSkills: List<String>, jobSkills: List<String>): Int {
        if (profileSkills.isEmpty() || jobSkills.isEmpty()) return 0
        val normalizedJobSkills = jobSkills.map(::normalize).filter(String::isNotBlank)
        val exactMatches = profileSkills.filter { profileSkill ->
            normalizedJobSkills.any { it == profileSkill || it.containsPhrase(profileSkill) }
        }.distinct()
        if (exactMatches.isNotEmpty()) return 5 + exactMatches.size

        val relatedMatch = profileSkills.any { profileSkill ->
            normalizedJobSkills.any { jobSkill ->
                skillFamilies.any { family ->
                    family.any { profileSkill.containsPhrase(it) } &&
                        family.any { jobSkill.containsPhrase(it) }
                } || tokens(profileSkill).any { it in tokens(jobSkill) }
            }
        }
        return if (relatedMatch) 2 else 0
    }

    private fun locationTiers(expectedLocation: String): List<Set<String>> {
        val location = normalize(expectedLocation)
        if (location.isBlank()) return emptyList()
        return when {
            location.containsPhrase("chennai") -> listOf(
                setOf("chennai"),
                setOf("bengaluru", "bangalore"),
                setOf("hyderabad")
            )
            location.containsPhrase("bangalore") || location.containsPhrase("bengaluru") ->
                listOf(setOf("bengaluru", "bangalore"))
            location.containsPhrase("hyderabad") -> listOf(setOf("hyderabad"))
            else -> listOf(tokens(location).toSet())
        }
    }

    private fun JobPost.matchesAnyCity(cities: Set<String>): Boolean {
        val jobLocation = normalize(location.orEmpty())
        return cities.any { jobLocation.containsPhrase(it) }
    }

    private fun String.containsPhrase(phrase: String): Boolean {
        val normalizedPhrase = normalize(phrase)
        return normalizedPhrase.isNotBlank() &&
            " $this ".contains(" $normalizedPhrase ")
    }

    private fun tokens(value: String): List<String> =
        normalize(value).split(" ").filter(String::isNotBlank)

    private fun normalize(value: String): String =
        value.lowercase().replace(Regex("[^a-z0-9]+"), " ").trim()

    private data class ScoredJob(
        val job: JobPost,
        val score: Int,
        val originalIndex: Int
    )
}

