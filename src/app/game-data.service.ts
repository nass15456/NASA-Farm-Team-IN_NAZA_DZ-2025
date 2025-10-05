import { Injectable } from '@angular/core';
import { EarthAreaWithClimate, LocationData } from './climate-data.service';

export interface EarthArea {
  id: number;
  name: string;
  temperature: number;
  soilType: string;
  description: string;
  coordinates: { x: number; y: number };
}

// Extended interface for real climate data
export interface EarthAreaExtended extends EarthArea {
  latitude?: number;
  longitude?: number;
  dayTemperature?: number;
  nightTemperature?: number;
  climateZone?: string;
  realData?: boolean;
}

export interface Crop {
  id: number;
  name: string;
  type: 'fruit' | 'vegetable' | 'legume';
  minTemperature: number;
  maxTemperature: number;
  soilRequirement: string;
  image: string;
  description: string;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  areaId: number;
}

@Injectable({
  providedIn: 'root'
})
export class GameDataService {
  private earthAreas: EarthArea[] = [
    {
      id: 1,
      name: 'Mediterranean Coast',
      temperature: 18,
      soilType: 'Sandy',
      description: 'Warm coastal area with sandy soil, perfect for Mediterranean crops.',
      coordinates: { x: 30, y: 40 }
    },
    {
      id: 2,
      name: 'European Plains',
      temperature: 8,
      soilType: 'Clay-rich',
      description: 'Temperate region with nutrient-rich clay soil, ideal for grains.',
      coordinates: { x: 60, y: 30 }
    },
    {
      id: 3,
      name: 'Mountain Highlands',
      temperature: 2,
      soilType: 'Rocky',
      description: 'Cool mountainous area with rocky terrain, suitable for hardy vegetables.',
      coordinates: { x: 45, y: 60 }
    },
    {
      id: 4,
      name: 'Tropical Valleys',
      temperature: 28,
      soilType: 'Volcanic',
      description: 'Warm tropical area with volcanic soil rich in minerals.',
      coordinates: { x: 70, y: 50 }
    }
  ];

  private crops: Crop[] = [
    {
      id: 1,
      name: 'Mediterranean Potato',
      type: 'vegetable',
      minTemperature: 10,
      maxTemperature: 25,
      soilRequirement: 'Sandy',
      image: '🥔',
      description: 'Hardy potato variety perfect for Mediterranean coastal areas.'
    },
    {
      id: 2,
      name: 'Heritage Tomato',
      type: 'fruit',
      minTemperature: 15,
      maxTemperature: 30,
      soilRequirement: 'Clay-rich',
      image: '🍅',
      description: 'Classic tomato variety thriving in rich clay soils.'
    },
    {
      id: 3,
      name: 'Alpine Spinach',
      type: 'vegetable',
      minTemperature: -5,
      maxTemperature: 15,
      soilRequirement: 'Rocky',
      image: '🥬',
      description: 'Cold-resistant leafy green adapted to mountain conditions.'
    },
    {
      id: 4,
      name: 'Tropical Beans',
      type: 'legume',
      minTemperature: 20,
      maxTemperature: 35,
      soilRequirement: 'Volcanic',
      image: '🫘',
      description: 'Nitrogen-fixing beans that thrive in volcanic tropical soil.'
    },
    {
      id: 5,
      name: 'Coastal Strawberry',
      type: 'fruit',
      minTemperature: 5,
      maxTemperature: 20,
      soilRequirement: 'Sandy',
      image: '🍓',
      description: 'Sweet strawberry variety adapted to coastal sandy soils.'
    },
    {
      id: 6,
      name: 'European Wheat',
      type: 'vegetable',
      minTemperature: 0,
      maxTemperature: 20,
      soilRequirement: 'Clay-rich',
      image: '🌾',
      description: 'Traditional wheat variety perfect for European plains.'
    }
  ];

  private quizQuestions: QuizQuestion[] = [
    {
      id: 1,
      question: 'Given the temperature of 18°C and sandy soil, which crop would be best suited for this Mediterranean area?',
      options: ['Mediterranean Potato', 'Heritage Tomato', 'Alpine Spinach', 'Tropical Beans'],
      correctAnswer: 0,
      explanation: 'Mediterranean Potato is perfect for 18°C temperature and sandy coastal soil conditions.',
      areaId: 1
    },
    {
      id: 2,
      question: 'With clay-rich soil and 8°C temperature, what would grow best in these European plains?',
      options: ['Coastal Strawberry', 'European Wheat', 'Heritage Tomato', 'Tropical Beans'],
      correctAnswer: 1,
      explanation: 'European Wheat thrives in clay-rich soil and can handle 8°C temperatures perfectly.',
      areaId: 2
    },
    {
      id: 3,
      question: 'In rocky soil at 2°C, which crop can survive these mountain highland conditions?',
      options: ['Heritage Tomato', 'Alpine Spinach', 'Mediterranean Potato', 'Coastal Strawberry'],
      correctAnswer: 1,
      explanation: 'Alpine Spinach is specifically adapted for rocky soil and cold mountain temperatures.',
      areaId: 3
    },
    {
      id: 4,
      question: 'The volcanic soil at 28°C is ideal for which tropical crop?',
      options: ['Tropical Beans', 'European Wheat', 'Alpine Spinach', 'Mediterranean Potato'],
      correctAnswer: 0,
      explanation: 'Tropical Beans love warm volcanic soil and thrive at 28°C temperatures.',
      areaId: 4
    }
  ];

  constructor() { }

  getEarthAreas(): EarthArea[] {
    return this.earthAreas;
  }

  getArea(id: number): EarthArea | undefined {
    return this.earthAreas.find(area => area.id === id);
  }

  getCrops(): Crop[] {
    return this.crops;
  }

  getQuizQuestion(areaId: number): QuizQuestion | undefined {
    return this.quizQuestions.find(q => q.areaId === areaId);
  }

  getSuitableCrops(area: EarthArea): Crop[] {
    return this.crops.filter(crop => 
      crop.minTemperature <= area.temperature && 
      crop.maxTemperature >= area.temperature &&
      crop.soilRequirement === area.soilType
    );
  }

  /**
   * Generate dynamic quiz question based on real climate data
   */
  generateClimateQuiz(locationData: LocationData): QuizQuestion {
    const { dayTemp, nightTemp, area } = locationData;
    const suitableCrops = this.getSuitableCropsForClimate(dayTemp, area.soilType);
    
    // Generate different types of questions
    const questionTypes = [
      this.generateTemperatureQuestion(dayTemp, nightTemp, area),
      this.generateCropSuitabilityQuestion(suitableCrops, area),
      this.generateClimateAdaptationQuestion(area),
      this.generateSoilTypeQuestion(area)
    ];

    return questionTypes[Math.floor(Math.random() * questionTypes.length)];
  }

  private generateTemperatureQuestion(dayTemp: number, nightTemp: number, area: EarthAreaWithClimate): QuizQuestion {
    const tempDiff = Math.abs(dayTemp - nightTemp);
    const avgTemp = Math.round((dayTemp + nightTemp) / 2);
    
    // Generate different question types about temperature
    const questionTypes = [
      // Temperature difference question
      {
        question: `In ${area.name}, the day temperature is ${dayTemp}°C and night temperature is ${nightTemp}°C. What is the temperature difference?`,
        correctAnswer: `${tempDiff}°C`,
        wrongAnswers: [`${tempDiff + 5}°C`, `${tempDiff - 3}°C`, `${tempDiff + 8}°C`],
        explanation: `The temperature difference between day (${dayTemp}°C) and night (${nightTemp}°C) is ${tempDiff}°C. This daily temperature variation affects crop selection and farming practices in ${area.climateZone} climates.`
      },
      // Average temperature question
      {
        question: `With day temperature of ${dayTemp}°C and night temperature of ${nightTemp}°C in ${area.name}, what is the average temperature?`,
        correctAnswer: `${avgTemp}°C`,
        wrongAnswers: [`${avgTemp + 3}°C`, `${avgTemp - 2}°C`, `${dayTemp}°C`],
        explanation: `The average temperature is calculated as (${dayTemp}°C + ${nightTemp}°C) ÷ 2 = ${avgTemp}°C. This average helps determine suitable crops for the region.`
      },
      // Climate classification question
      {
        question: `Based on the temperature data (Day: ${dayTemp}°C, Night: ${nightTemp}°C) in ${area.name}, this represents which climate pattern?`,
        correctAnswer: this.getTemperaturePattern(dayTemp, nightTemp),
        wrongAnswers: this.getWrongTemperaturePatterns(this.getTemperaturePattern(dayTemp, nightTemp)),
        explanation: `With day temperatures of ${dayTemp}°C and night temperatures of ${nightTemp}°C, this shows ${this.getTemperaturePattern(dayTemp, nightTemp).toLowerCase()} conditions typical of ${area.climateZone} regions.`
      }
    ];

    const selectedQuestion = questionTypes[Math.floor(Math.random() * questionTypes.length)];
    const options = [selectedQuestion.correctAnswer, ...selectedQuestion.wrongAnswers]
      .sort(() => Math.random() - 0.5);

    return {
      id: Date.now(),
      question: selectedQuestion.question,
      options,
      correctAnswer: options.indexOf(selectedQuestion.correctAnswer),
      explanation: selectedQuestion.explanation,
      areaId: area.id
    };
  }

  private getTemperaturePattern(dayTemp: number, nightTemp: number): string {
    const tempDiff = Math.abs(dayTemp - nightTemp);
    const avgTemp = (dayTemp + nightTemp) / 2;

    if (avgTemp > 25) {
      return tempDiff > 10 ? 'Hot with large daily variation' : 'Consistently hot conditions';
    } else if (avgTemp > 15) {
      return tempDiff > 12 ? 'Moderate with significant daily swings' : 'Temperate conditions';
    } else if (avgTemp > 5) {
      return tempDiff > 8 ? 'Cool with moderate variation' : 'Cool stable conditions';
    } else {
      return tempDiff > 5 ? 'Cold with daily fluctuation' : 'Consistently cold conditions';
    }
  }

  private getWrongTemperaturePatterns(correctPattern: string): string[] {
    const allPatterns = [
      'Hot with large daily variation',
      'Consistently hot conditions',
      'Moderate with significant daily swings',
      'Temperate conditions',
      'Cool with moderate variation',
      'Cool stable conditions',
      'Cold with daily fluctuation',
      'Consistently cold conditions'
    ];

    return allPatterns.filter(pattern => pattern !== correctPattern).slice(0, 3);
  }

  private generateCropSuitabilityQuestion(suitableCrops: Crop[], area: EarthAreaWithClimate): QuizQuestion {
    if (suitableCrops.length === 0) {
      suitableCrops = this.crops.slice(0, 2); // Fallback
    }

    const correctCrop = suitableCrops[0];
    const wrongCrops = this.crops.filter(c => !suitableCrops.includes(c)).slice(0, 3);
    
    const options = [correctCrop.name, ...wrongCrops.map(c => c.name)]
      .sort(() => Math.random() - 0.5);

    return {
      id: Date.now() + 1,
      question: `With ${area.climateZone?.toLowerCase()} climate, ${area.dayTemperature}°C average temperature, and ${area.soilType?.toLowerCase()} soil in ${area.name}, which crop would be most suitable?`,
      options,
      correctAnswer: options.indexOf(correctCrop.name),
      explanation: `${correctCrop.name} is ideal for this location because it thrives in temperatures between ${correctCrop.minTemperature}°C and ${correctCrop.maxTemperature}°C and grows well in ${correctCrop.soilRequirement?.toLowerCase()} soil.`,
      areaId: area.id
    };
  }

  private generateClimateAdaptationQuestion(area: EarthAreaWithClimate): QuizQuestion {
    const adaptations = this.getClimateAdaptations(area.climateZone || 'Temperate');
    const correctAdaptation = adaptations[0];
    const wrongAdaptations = [
      'Use only greenhouse farming',
      'Plant crops randomly throughout the year',
      'Ignore soil moisture levels',
      'Use identical farming methods worldwide'
    ].filter(a => a !== correctAdaptation).slice(0, 3);

    const options = [correctAdaptation, ...wrongAdaptations]
      .sort(() => Math.random() - 0.5);

    return {
      id: Date.now() + 2,
      question: `In the ${area.climateZone} climate zone of ${area.name}, what farming adaptation would be most effective?`,
      options,
      correctAnswer: options.indexOf(correctAdaptation),
      explanation: `In ${area.climateZone?.toLowerCase()} climates, ${correctAdaptation?.toLowerCase()} is essential for successful agriculture due to the specific temperature and precipitation patterns.`,
      areaId: area.id
    };
  }

  private generateSoilTypeQuestion(area: EarthAreaWithClimate): QuizQuestion {
    const soilBenefits = this.getSoilBenefits(area.soilType || 'Loamy');
    const correctBenefit = soilBenefits[0];
    const wrongBenefits = [
      'Poor water retention',
      'Low nutrient content',
      'Difficult to cultivate',
      'Unsuitable for most crops'
    ].filter(b => b !== correctBenefit).slice(0, 3);

    const options = [correctBenefit, ...wrongBenefits]
      .sort(() => Math.random() - 0.5);

    return {
      id: Date.now() + 3,
      question: `The ${area.soilType?.toLowerCase()} soil in ${area.name} provides which main advantage for agriculture?`,
      options,
      correctAnswer: options.indexOf(correctBenefit),
      explanation: `${area.soilType} soil is beneficial because it ${correctBenefit?.toLowerCase()}, making it suitable for various agricultural practices.`,
      areaId: area.id
    };
  }

  private getSuitableCropsForClimate(temperature: number, soilType: string): Crop[] {
    return this.crops.filter(crop => 
      crop.minTemperature <= temperature && 
      crop.maxTemperature >= temperature &&
      (crop.soilRequirement === soilType || Math.random() < 0.3) // Some flexibility
    );
  }

  private getClimateAdaptations(climateZone: string): string[] {
    const adaptationMap: {[key: string]: string[]} = {
      'Tropical': ['Use shade cloth to protect from intense sun', 'Implement efficient drainage systems', 'Choose heat-resistant crop varieties'],
      'Subtropical': ['Plan for wet and dry seasons', 'Use mulching to retain moisture', 'Select drought-tolerant varieties'],
      'Temperate': ['Rotate crops seasonally', 'Use frost protection methods', 'Implement season extension techniques'],
      'Continental': ['Use cold-frame protection', 'Select short-season varieties', 'Implement wind protection'],
      'Polar': ['Use greenhouse cultivation', 'Employ soil heating systems', 'Choose arctic-adapted varieties']
    };
    
    return adaptationMap[climateZone] || adaptationMap['Temperate'];
  }

  private getSoilBenefits(soilType: string): string[] {
    const benefitMap: {[key: string]: string[]} = {
      'Sandy': ['Excellent drainage', 'Easy to work with', 'Good root penetration'],
      'Clay-rich': ['High nutrient retention', 'Good water holding capacity', 'Rich in minerals'],
      'Volcanic': ['Exceptional fertility', 'Rich in trace minerals', 'Good structure'],
      'Rocky': ['Good drainage', 'Mineral rich', 'Suitable for hardy crops'],
      'Loamy': ['Perfect balance of nutrients', 'Ideal water retention', 'Easy cultivation'],
      'Peaty': ['High organic content', 'Excellent for root vegetables', 'Rich in nutrients']
    };
    
    return benefitMap[soilType] || benefitMap['Loamy'];
  }
}
