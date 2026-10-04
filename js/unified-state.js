/* TrainMei Phase 6 — Unified State facade
   Single mutable application-state contract between TrainingDataCore and UI modules. */
(()=>{
  const TP=window.__tp;
  if(!TP){console.error('TrainMei Unified State: planner API unavailable');return;}
  const State={
    VERSION:'1.0.0',
    get currentUser(){return TP.currentUser},set currentUser(v){TP.currentUser=v},
    get currentDay(){return TP.currentDay},set currentDay(v){TP.currentDay=v},
    get selectedDateKey(){return TP.selectedDateKey},set selectedDateKey(v){TP.selectedDateKey=v},
    get smartWorkout(){return TP.smartWorkout},set smartWorkout(v){TP.smartWorkout=v},
    get templatesCache(){return TP.templatesCache},set templatesCache(v){TP.templatesCache=v},
    get templateEditorMode(){return TP.templateEditorMode},set templateEditorMode(v){TP.templateEditorMode=v},
    get templateEditorId(){return TP.templateEditorId},set templateEditorId(v){TP.templateEditorId=v},
    get monthIndicators(){return TP.monthIndicators},set monthIndicators(v){TP.monthIndicators=v},
    monthCursor:TP.monthCursor,setMonthCursor:TP.setMonthCursor,
    get planData(){return TP.planData},set planData(v){TP.planData=v},
    get activeBlockIndex(){return TP.activeBlockIndex},set activeBlockIndex(v){TP.activeBlockIndex=v},
    get planWeekKey(){return TP.planWeekKey},set planWeekKey(v){TP.planWeekKey=v},
    todayKey:TP.todayKey,dateKey:TP.dateKey,clone:TP.clone,normalizeDay:TP.normalizeDay,defaultDay:TP.defaultDay,
    openDay:TP.openDay,saveDay:TP.saveDay,scheduleSave:TP.scheduleSave,setStatus:TP.setStatus,
    loadTemplates:TP.loadTemplates,renderTemplates:TP.renderTemplates,renderDay:TP.renderDay,renderMonth:TP.renderMonth,savePlanCloud:(...args)=>TP.savePlanCloud?.(...args),
    applyRecurring:TP.applyRecurring,showPage:TP.showPage,setVal:TP.setVal,
    getAnalyticsRows:TP.getAnalyticsRows,allWorkoutRows:TP.allWorkoutRows,totalExerciseSets:TP.totalExerciseSets,totalExerciseReps:TP.totalExerciseReps,exerciseSetText:TP.exerciseSetText,
    exerciseSetGroups:TP.exerciseSetGroups,loadDayLocal:TP.loadDayLocal,loadDay:TP.loadDay,persistCurrentDayLocal:TP.persistCurrentDayLocal,
    clearSaveTimer:TP.clearSaveTimer,supabaseClient:TP.supabaseClient,
    get dataCore(){return window.TrainingDataCore||null},
    get workoutEditor(){return window.TrainMeiWorkoutEditor||null},
    get planning(){return window.TrainMeiPlanning||null},
    get calendar(){return window.TrainMeiCalendar||null},
    get templates(){return window.TrainMeiTemplates||null},
    emit(name,detail){document.dispatchEvent(new CustomEvent(name,{detail}))},
    on(name,handler,options){document.addEventListener(name,handler,options);return()=>document.removeEventListener(name,handler,options)},
    snapshot(){return {date:this.selectedDateKey,day:this.currentDay,user:this.currentUser,plan:this.planData}}
  };
  window.TrainMeiState=State;
})();
