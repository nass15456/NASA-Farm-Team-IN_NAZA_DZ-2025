import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { GameDataService, EarthAreaExtended, QuizQuestion, Crop } from '../game-data.service';
import { LocationData } from '../climate-data.service';

@Component({
  selector: 'app-quiz',
  templateUrl: './quiz.component.html',
  styleUrls: ['./quiz.component.scss']
})
export class QuizComponent implements OnInit {
  @Input() selectedArea: EarthAreaExtended | null = null;
  @Input() locationData: LocationData | null = null;
  @Output() backToFarming = new EventEmitter<void>();
  
  currentQuestion: QuizQuestion | null = null;
  selectedAnswer: number | null = null;
  showResult: boolean = false;
  isCorrect: boolean = false;
  suitableCrops: Crop[] = [];
  isRealData: boolean = false;
  
  constructor(private gameDataService: GameDataService) {}

  ngOnInit() {
    if (this.selectedArea) {
      this.isRealData = this.selectedArea.realData || false;
      
      if (this.isRealData && this.locationData) {
        // Generate dynamic quiz based on real climate data
        this.currentQuestion = this.gameDataService.generateClimateQuiz(this.locationData);
      } else {
        // Use pre-defined quiz questions for static areas
        this.currentQuestion = this.gameDataService.getQuizQuestion(this.selectedArea.id) || null;
      }
      
      this.suitableCrops = this.gameDataService.getSuitableCrops(this.selectedArea);
    }
  }

  selectAnswer(answerIndex: number) {
    this.selectedAnswer = answerIndex;
  }

  submitAnswer() {
    if (this.selectedAnswer !== null && this.currentQuestion) {
      this.isCorrect = this.selectedAnswer === this.currentQuestion.correctAnswer;
      this.showResult = true;
    }
  }

  resetQuiz() {
    this.selectedAnswer = null;
    this.showResult = false;
    this.isCorrect = false;
  }

  onBackToFarming() {
    this.backToFarming.emit();
  }

  getOptionLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }
}
