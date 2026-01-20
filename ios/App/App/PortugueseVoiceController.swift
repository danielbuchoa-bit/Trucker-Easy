import Foundation
import MapboxNavigation
import AVFoundation

/**
 * Portuguese Voice Controller
 * 
 * Provides PT-BR voice guidance for navigation using:
 * - Mapbox Speech API with Portuguese localization
 * - Native iOS AVSpeechSynthesizer as fallback
 */
class PortugueseVoiceController {
    
    // MARK: - Properties
    
    private let speechSynthesizer = AVSpeechSynthesizer()
    private let locale = Locale(identifier: "pt-BR")
    
    // Voice configuration
    private let voiceRate: Float = 0.52
    private let voicePitch: Float = 1.0
    private let voiceVolume: Float = 1.0
    
    // Instruction translations
    private let instructionTranslations: [String: String] = [
        "Turn left": "Vire à esquerda",
        "Turn right": "Vire à direita",
        "Continue straight": "Continue em frente",
        "Take the exit": "Pegue a saída",
        "Keep left": "Mantenha-se à esquerda",
        "Keep right": "Mantenha-se à direita",
        "Merge": "Mescle",
        "Slight left": "Vire levemente à esquerda",
        "Slight right": "Vire levemente à direita",
        "Sharp left": "Vire acentuadamente à esquerda",
        "Sharp right": "Vire acentuadamente à direita",
        "U-turn": "Faça o retorno",
        "Enter roundabout": "Entre na rotatória",
        "Exit roundabout": "Saia da rotatória",
        "You have arrived": "Você chegou ao seu destino",
        "Arrive at": "Chegando em",
        "In": "Em",
        "meters": "metros",
        "kilometers": "quilômetros",
        "miles": "milhas",
        "feet": "pés",
        "then": "depois"
    ]
    
    // Distance format
    private func formatDistance(_ meters: Double) -> String {
        if meters < 1000 {
            return "\(Int(meters)) metros"
        } else {
            let km = meters / 1000.0
            return String(format: "%.1f quilômetros", km)
        }
    }
    
    // MARK: - Public Methods
    
    /// Speak navigation instruction in PT-BR
    func speak(_ instruction: String, distance: Double? = nil) {
        var text = translateInstruction(instruction)
        
        if let dist = distance {
            text = "Em \(formatDistance(dist)), \(text)"
        }
        
        speakText(text)
    }
    
    /// Speak upcoming maneuver
    func speakManeuver(type: String, direction: String?, roadName: String?, distance: Double) {
        var instruction = ""
        
        // Build instruction based on maneuver type
        switch type.lowercased() {
        case "turn":
            if direction?.lowercased() == "left" {
                instruction = "Vire à esquerda"
            } else if direction?.lowercased() == "right" {
                instruction = "Vire à direita"
            }
        case "exit":
            instruction = "Pegue a saída"
        case "merge":
            instruction = "Mescle"
        case "fork":
            if direction?.lowercased() == "left" {
                instruction = "Mantenha-se à esquerda"
            } else {
                instruction = "Mantenha-se à direita"
            }
        case "roundabout":
            instruction = "Entre na rotatória"
        case "arrive":
            instruction = "Você chegou ao seu destino"
        default:
            instruction = "Continue"
        }
        
        // Add road name if available
        if let road = roadName, !road.isEmpty {
            instruction += " na \(road)"
        }
        
        // Add distance prefix
        let fullInstruction = "Em \(formatDistance(distance)), \(instruction)"
        
        speakText(fullInstruction)
    }
    
    /// Speak arrival message
    func speakArrival(destinationName: String?) {
        let text: String
        if let name = destinationName, !name.isEmpty {
            text = "Você chegou ao seu destino, \(name)"
        } else {
            text = "Você chegou ao seu destino"
        }
        speakText(text)
    }
    
    /// Speak reroute notification
    func speakReroute() {
        speakText("Recalculando rota")
    }
    
    /// Stop current speech
    func stopSpeaking() {
        if speechSynthesizer.isSpeaking {
            speechSynthesizer.stopSpeaking(at: .immediate)
        }
    }
    
    // MARK: - Private Methods
    
    private func translateInstruction(_ instruction: String) -> String {
        var translated = instruction
        
        for (english, portuguese) in instructionTranslations {
            translated = translated.replacingOccurrences(
                of: english,
                with: portuguese,
                options: .caseInsensitive
            )
        }
        
        return translated
    }
    
    private func speakText(_ text: String) {
        // Stop any current speech
        stopSpeaking()
        
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "pt-BR")
        utterance.rate = voiceRate
        utterance.pitchMultiplier = voicePitch
        utterance.volume = voiceVolume
        
        // Pre-speak silence for natural pacing
        utterance.preUtteranceDelay = 0.1
        utterance.postUtteranceDelay = 0.1
        
        speechSynthesizer.speak(utterance)
        
        print("[VoicePTBR] Speaking: \(text)")
    }
}
